#!/usr/bin/env node

/**
 * ACT Performance Benchmarker
 * Comprehensive performance testing and benchmarking for GitHub Actions workflows
 * 
 * Features:
 * - Execution time benchmarking
 * - Memory usage analysis
 * - Platform performance comparison
 * - Workflow optimization recommendations
 * - Performance regression detection
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ActPerformanceBenchmarker {
  constructor(options = {}) {
    this.options = {
      workflowsDir: '.github/workflows',
      resultsDir: 'tests/workflows/results',
      benchmarkIterations: 3,
      platforms: ['ubuntu-latest', 'ubuntu-20.04'],
      events: ['push'],
      timeoutMs: 300000, // 5 minutes per test
      performanceThresholds: {
        fast: 30000,      // < 30 seconds
        medium: 120000,   // < 2 minutes
        slow: 300000      // < 5 minutes
      },
      ...options
    };

    this.benchmarkResults = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        framework: 'ACT Performance Benchmarker',
        version: '1.0.0',
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
          actVersion: this.getActVersion()
        }
      },
      summary: {
        totalWorkflows: 0,
        benchmarkedWorkflows: 0,
        totalTests: 0,
        completedTests: 0,
        failedTests: 0,
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        totalExecutionTime: 0
      },
      workflows: [],
      platformComparison: {},
      recommendations: []
    };
  }

  /**
   * Run comprehensive performance benchmarks
   */
  async runBenchmarks() {
    console.log('⚡ ACT Performance Benchmarker - Starting Comprehensive Analysis');
    console.log('================================================================\n');

    try {
      const workflows = await this.discoverWorkflows();
      this.benchmarkResults.summary.totalWorkflows = workflows.length;

      // Benchmark selected workflows
      const selectedWorkflows = this.selectWorkflowsForBenchmarking(workflows);
      
      for (const workflowPath of selectedWorkflows) {
        await this.benchmarkWorkflow(workflowPath);
        this.benchmarkResults.summary.benchmarkedWorkflows++;
      }

      this.calculateFinalStatistics();
      this.generatePlatformComparison();
      this.generatePerformanceReport();

      return this.benchmarkResults;

    } catch (error) {
      console.error('❌ Performance benchmarking failed:', error.message);
      throw error;
    }
  }

  /**
   * Discover workflows for benchmarking
   */
  async discoverWorkflows() {
    console.log('🔍 Discovering workflows for performance analysis...');
    
    if (!fs.existsSync(this.options.workflowsDir)) {
      throw new Error(`Workflows directory not found: ${this.options.workflowsDir}`);
    }

    const workflows = fs.readdirSync(this.options.workflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .map(file => path.join(this.options.workflowsDir, file));

    console.log(`📊 Found ${workflows.length} workflows for analysis`);
    return workflows;
  }

  /**
   * Select representative workflows for benchmarking
   */
  selectWorkflowsForBenchmarking(workflows) {
    console.log('🎯 Selecting workflows for performance benchmarking...');
    
    // Priority workflows for benchmarking
    const priorityWorkflows = [
      'pr-checks.yml',
      'optimized-ci.yml',
      'deployment.yml',
      'security.yml',
      'release.yml'
    ];

    const selected = [];
    
    // Add priority workflows if they exist
    for (const priority of priorityWorkflows) {
      const fullPath = workflows.find(w => path.basename(w) === priority);
      if (fullPath) {
        selected.push(fullPath);
      }
    }

    // Add a few additional workflows for comprehensive testing
    const additional = workflows
      .filter(w => !selected.includes(w))
      .slice(0, Math.min(5, Math.max(0, 8 - selected.length))); // Up to 8 total workflows
    
    selected.push(...additional);
    
    console.log(`🎯 Selected ${selected.length} workflows for benchmarking:`);
    selected.forEach(w => console.log(`  - ${path.basename(w)}`));
    
    return selected;
  }

  /**
   * Benchmark individual workflow
   */
  async benchmarkWorkflow(workflowPath) {
    const workflowName = path.basename(workflowPath);
    console.log(`\n⚡ Benchmarking workflow: ${workflowName}`);

    const workflowBenchmark = {
      name: workflowName,
      path: workflowPath,
      platforms: {},
      overall: {
        executionTimes: [],
        averageTime: 0,
        medianTime: 0,
        minTime: Infinity,
        maxTime: 0,
        performanceCategory: 'unknown',
        reliability: 0
      },
      analysis: {
        complexity: 'unknown',
        bottlenecks: [],
        optimizationPotential: 'unknown'
      }
    };

    // Analyze workflow complexity
    workflowBenchmark.analysis.complexity = this.analyzeWorkflowComplexity(workflowPath);

    // Benchmark across platforms and events
    for (const platform of this.options.platforms) {
      console.log(`  🖥️  Testing on ${platform}...`);
      
      workflowBenchmark.platforms[platform] = {
        executionTimes: [],
        averageTime: 0,
        successRate: 0,
        errors: []
      };

      for (const event of this.options.events) {
        const platformResults = await this.benchmarkWorkflowOnPlatform(
          workflowPath, platform, event
        );
        
        // Aggregate platform results
        if (platformResults.length > 0) {
          workflowBenchmark.platforms[platform].executionTimes.push(...platformResults.map(r => r.executionTime));
          workflowBenchmark.platforms[platform].errors.push(...platformResults.filter(r => r.error).map(r => r.error));
        }
      }

      // Calculate platform statistics
      const platformTimes = workflowBenchmark.platforms[platform].executionTimes.filter(t => t > 0);
      if (platformTimes.length > 0) {
        workflowBenchmark.platforms[platform].averageTime = 
          platformTimes.reduce((sum, time) => sum + time, 0) / platformTimes.length;
        
        workflowBenchmark.platforms[platform].successRate = 
          (platformTimes.length / this.options.benchmarkIterations) * 100;
        
        // Add to overall times
        workflowBenchmark.overall.executionTimes.push(...platformTimes);
      }
    }

    // Calculate overall statistics
    this.calculateWorkflowStatistics(workflowBenchmark);
    
    // Generate workflow-specific recommendations
    workflowBenchmark.recommendations = this.generateWorkflowRecommendations(workflowBenchmark);

    this.benchmarkResults.workflows.push(workflowBenchmark);
    
    console.log(`  📊 Average execution time: ${Math.round(workflowBenchmark.overall.averageTime)}ms`);
    console.log(`  🏷️  Performance category: ${workflowBenchmark.overall.performanceCategory}`);
    
    return workflowBenchmark;
  }

  /**
   * Benchmark workflow on specific platform
   */
  async benchmarkWorkflowOnPlatform(workflowPath, platform, event) {
    const results = [];
    
    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      console.log(`    🔄 Iteration ${i + 1}/${this.options.benchmarkIterations}`);
      
      const result = await this.runSingleBenchmark(workflowPath, platform, event);
      results.push(result);
      this.benchmarkResults.summary.totalTests++;
      
      if (result.success) {
        this.benchmarkResults.summary.completedTests++;
      } else {
        this.benchmarkResults.summary.failedTests++;
      }
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Run single benchmark iteration
   */
  async runSingleBenchmark(workflowPath, platform, event) {
    return new Promise((resolve) => {
      const startTime = this.getDeterministicTimestamp();
      let output = '';
      let error = null;
      
      const command = `act ${event} --workflows "${workflowPath}" --platform ${platform} --dry-run`;
      const child = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        const executionTime = this.getDeterministicTimestamp() - startTime;
        
        resolve({
          success: code === 0,
          executionTime: executionTime,
          exitCode: code,
          output: output,
          error: code !== 0 ? output : null
        });
      });

      // Timeout handling
      setTimeout(() => {
        child.kill();
        const executionTime = this.getDeterministicTimestamp() - startTime;
        
        resolve({
          success: false,
          executionTime: executionTime,
          exitCode: -1,
          output: output,
          error: 'Benchmark timed out'
        });
      }, this.options.timeoutMs);
    });
  }

  /**
   * Analyze workflow complexity
   */
  analyzeWorkflowComplexity(workflowPath) {
    try {
      const content = fs.readFileSync(workflowPath, 'utf8');
      
      // Count various complexity indicators
      const jobCount = (content.match(/^\s*[\w-]+:\s*$/gm) || []).length;
      const stepCount = (content.match(/^\s*-\s*name:/gm) || []).length;
      const actionCount = (content.match(/^\s*uses:/gm) || []).length;
      const hasMatrix = content.includes('matrix:');
      const hasServices = content.includes('services:');
      const hasConditionals = content.includes('if:');
      
      // Calculate complexity score
      let complexity = 0;
      complexity += jobCount * 2;
      complexity += stepCount;
      complexity += actionCount;
      complexity += hasMatrix ? 5 : 0;
      complexity += hasServices ? 3 : 0;
      complexity += hasConditionals ? 2 : 0;
      
      if (complexity <= 10) return 'low';
      if (complexity <= 25) return 'medium';
      return 'high';
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate workflow statistics
   */
  calculateWorkflowStatistics(workflowBenchmark) {
    const times = workflowBenchmark.overall.executionTimes;
    
    if (times.length === 0) {
      return;
    }
    
    // Calculate basic statistics
    workflowBenchmark.overall.averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    workflowBenchmark.overall.minTime = Math.min(...times);
    workflowBenchmark.overall.maxTime = Math.max(...times);
    
    // Calculate median
    const sortedTimes = [...times].sort((a, b) => a - b);
    const middle = Math.floor(sortedTimes.length / 2);
    workflowBenchmark.overall.medianTime = sortedTimes.length % 2 === 0 ?
      (sortedTimes[middle - 1] + sortedTimes[middle]) / 2 :
      sortedTimes[middle];
    
    // Determine performance category
    const avgTime = workflowBenchmark.overall.averageTime;
    if (avgTime < this.options.performanceThresholds.fast) {
      workflowBenchmark.overall.performanceCategory = 'fast';
    } else if (avgTime < this.options.performanceThresholds.medium) {
      workflowBenchmark.overall.performanceCategory = 'medium';
    } else if (avgTime < this.options.performanceThresholds.slow) {
      workflowBenchmark.overall.performanceCategory = 'slow';
    } else {
      workflowBenchmark.overall.performanceCategory = 'very_slow';
    }
    
    // Calculate reliability (based on consistency)
    const coefficient = times.length > 1 ? 
      (Math.sqrt(times.map(t => Math.pow(t - workflowBenchmark.overall.averageTime, 2)).reduce((a, b) => a + b, 0) / times.length) / workflowBenchmark.overall.averageTime) : 0;
    
    workflowBenchmark.overall.reliability = Math.max(0, Math.min(100, 100 - (coefficient * 100)));
    
    // Identify potential bottlenecks
    if (workflowBenchmark.analysis.complexity === 'high' && avgTime > this.options.performanceThresholds.medium) {
      workflowBenchmark.analysis.bottlenecks.push('High complexity workflow');
    }
    
    if (workflowBenchmark.overall.reliability < 80) {
      workflowBenchmark.analysis.bottlenecks.push('Inconsistent execution times');
    }
    
    // Determine optimization potential
    if (avgTime > this.options.performanceThresholds.medium) {
      workflowBenchmark.analysis.optimizationPotential = 'high';
    } else if (avgTime > this.options.performanceThresholds.fast) {
      workflowBenchmark.analysis.optimizationPotential = 'medium';
    } else {
      workflowBenchmark.analysis.optimizationPotential = 'low';
    }
  }

  /**
   * Generate workflow-specific recommendations
   */
  generateWorkflowRecommendations(workflowBenchmark) {
    const recommendations = [];
    
    if (workflowBenchmark.overall.performanceCategory === 'very_slow') {
      recommendations.push('Consider breaking down this workflow into smaller, parallel jobs');
      recommendations.push('Review job dependencies and optimize the critical path');
    }
    
    if (workflowBenchmark.overall.performanceCategory === 'slow') {
      recommendations.push('Look for opportunities to parallelize jobs or steps');
      recommendations.push('Consider caching dependencies to reduce setup time');
    }
    
    if (workflowBenchmark.analysis.complexity === 'high') {
      recommendations.push('Consider splitting complex workflow into multiple smaller workflows');
      recommendations.push('Use workflow_call to create reusable workflow components');
    }
    
    if (workflowBenchmark.overall.reliability < 80) {
      recommendations.push('Investigate inconsistent execution times - may indicate external dependencies');
      recommendations.push('Add timeout configurations to prevent hanging operations');
    }
    
    if (workflowBenchmark.analysis.bottlenecks.length > 0) {
      recommendations.push(`Address identified bottlenecks: ${workflowBenchmark.analysis.bottlenecks.join(', ')}`);
    }
    
    // Platform-specific recommendations
    const platformTimes = Object.entries(workflowBenchmark.platforms).map(([platform, data]) => ({
      platform,
      time: data.averageTime
    }));
    
    if (platformTimes.length > 1) {
      const fastestPlatform = platformTimes.reduce((min, p) => p.time < min.time ? p : min);
      const slowestPlatform = platformTimes.reduce((max, p) => p.time > max.time ? p : max);
      
      if (slowestPlatform.time > fastestPlatform.time * 1.5) {
        recommendations.push(`Performance varies significantly across platforms - ${slowestPlatform.platform} is ${Math.round((slowestPlatform.time / fastestPlatform.time - 1) * 100)}% slower than ${fastestPlatform.platform}`);
      }
    }
    
    return recommendations;
  }

  /**
   * Calculate final statistics
   */
  calculateFinalStatistics() {
    console.log('\n📊 Calculating final performance statistics...');
    
    const allExecutionTimes = this.benchmarkResults.workflows
      .flatMap(w => w.overall.executionTimes)
      .filter(time => time > 0);
    
    if (allExecutionTimes.length === 0) {
      console.warn('⚠️ No successful benchmark results to analyze');
      return;
    }
    
    this.benchmarkResults.summary.averageExecutionTime = 
      allExecutionTimes.reduce((sum, time) => sum + time, 0) / allExecutionTimes.length;
    
    this.benchmarkResults.summary.totalExecutionTime = 
      allExecutionTimes.reduce((sum, time) => sum + time, 0);
    
    const sortedTimes = [...allExecutionTimes].sort((a, b) => a - b);
    const middle = Math.floor(sortedTimes.length / 2);
    this.benchmarkResults.summary.medianExecutionTime = sortedTimes.length % 2 === 0 ?
      (sortedTimes[middle - 1] + sortedTimes[middle]) / 2 :
      sortedTimes[middle];
  }

  /**
   * Generate platform comparison analysis
   */
  generatePlatformComparison() {
    console.log('🖥️  Generating platform performance comparison...');
    
    for (const platform of this.options.platforms) {
      const platformData = {
        totalTests: 0,
        successfulTests: 0,
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        successRate: 0,
        performanceRating: 'unknown'
      };
      
      const platformTimes = [];
      
      for (const workflow of this.benchmarkResults.workflows) {
        if (workflow.platforms[platform]) {
          const times = workflow.platforms[platform].executionTimes.filter(t => t > 0);
          platformTimes.push(...times);
          platformData.totalTests += this.options.benchmarkIterations;
          platformData.successfulTests += times.length;
        }
      }
      
      if (platformTimes.length > 0) {
        platformData.averageExecutionTime = platformTimes.reduce((sum, time) => sum + time, 0) / platformTimes.length;
        
        const sortedTimes = [...platformTimes].sort((a, b) => a - b);
        const middle = Math.floor(sortedTimes.length / 2);
        platformData.medianExecutionTime = sortedTimes.length % 2 === 0 ?
          (sortedTimes[middle - 1] + sortedTimes[middle]) / 2 :
          sortedTimes[middle];
        
        platformData.successRate = (platformData.successfulTests / platformData.totalTests) * 100;
        
        // Determine performance rating
        if (platformData.averageExecutionTime < this.options.performanceThresholds.fast) {
          platformData.performanceRating = 'excellent';
        } else if (platformData.averageExecutionTime < this.options.performanceThresholds.medium) {
          platformData.performanceRating = 'good';
        } else {
          platformData.performanceRating = 'needs_improvement';
        }
      }
      
      this.benchmarkResults.platformComparison[platform] = platformData;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    console.log('\n📈 Generating comprehensive performance report...');
    
    // Generate overall recommendations
    this.benchmarkResults.recommendations = this.generateOverallRecommendations();
    
    // Save JSON report
    const reportFile = path.join(this.options.resultsDir, `performance-benchmark-${this.getDeterministicTimestamp()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(this.benchmarkResults, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownPerformanceReport();
    const markdownFile = path.join(this.options.resultsDir, 'performance-benchmark-report.md');
    fs.writeFileSync(markdownFile, markdownReport);
    
    console.log(`📄 Performance report saved: ${reportFile}`);
    console.log(`📝 Markdown report saved: ${markdownFile}`);
    
    return this.benchmarkResults;
  }

  generateMarkdownPerformanceReport() {
    const successRate = this.benchmarkResults.summary.totalTests > 0 ?
      Math.round((this.benchmarkResults.summary.completedTests / this.benchmarkResults.summary.totalTests) * 100) : 0;

    return `# ACT Performance Benchmark Report

## Executive Summary

🎯 **Overall Success Rate**: ${successRate}%  
⚡ **Average Execution Time**: ${Math.round(this.benchmarkResults.summary.averageExecutionTime)}ms  
📊 **Median Execution Time**: ${Math.round(this.benchmarkResults.summary.medianExecutionTime)}ms  
🔢 **Total Tests**: ${this.benchmarkResults.summary.totalTests}  
✅ **Completed Tests**: ${this.benchmarkResults.summary.completedTests}  

## Workflow Performance Analysis

| Workflow | Category | Avg Time (ms) | Median (ms) | Reliability | Complexity |
|----------|----------|---------------|-------------|-------------|------------|
${this.benchmarkResults.workflows.map(w => 
  `| ${w.name} | ${this.getCategoryEmoji(w.overall.performanceCategory)} ${w.overall.performanceCategory} | ${Math.round(w.overall.averageTime)} | ${Math.round(w.overall.medianTime)} | ${Math.round(w.overall.reliability)}% | ${w.analysis.complexity} |`
).join('\n')}

## Platform Comparison

${Object.entries(this.benchmarkResults.platformComparison).map(([platform, data]) => `### ${platform}

- **Average Time**: ${Math.round(data.averageExecutionTime)}ms
- **Median Time**: ${Math.round(data.medianExecutionTime)}ms
- **Success Rate**: ${Math.round(data.successRate)}%
- **Performance Rating**: ${this.getRatingEmoji(data.performanceRating)} ${data.performanceRating.replace(/_/g, ' ')}
`).join('\n')}

## Detailed Workflow Analysis

${this.benchmarkResults.workflows.map(w => `### ${w.name}

**Performance Category**: ${this.getCategoryEmoji(w.overall.performanceCategory)} ${w.overall.performanceCategory}  
**Complexity**: ${w.analysis.complexity}  
**Optimization Potential**: ${w.analysis.optimizationPotential}  

**Execution Statistics**:
- Average Time: ${Math.round(w.overall.averageTime)}ms
- Median Time: ${Math.round(w.overall.medianTime)}ms
- Min Time: ${Math.round(w.overall.minTime)}ms
- Max Time: ${Math.round(w.overall.maxTime)}ms
- Reliability: ${Math.round(w.overall.reliability)}%

${w.analysis.bottlenecks.length > 0 ? `**Bottlenecks Identified**:
${w.analysis.bottlenecks.map(b => `- ${b}`).join('\n')}

` : ''}
**Platform Performance**:
${Object.entries(w.platforms).map(([platform, data]) => 
  `- **${platform}**: Avg ${Math.round(data.averageTime)}ms (${Math.round(data.successRate)}% success)`
).join('\n')}

**Recommendations**:
${w.recommendations.map(r => `- ${r}`).join('\n')}
`).join('\n')}

## Overall Recommendations

${this.benchmarkResults.recommendations.map(r => `- ${r}`).join('\n')}

## Performance Thresholds

- **Fast**: < ${this.options.performanceThresholds.fast}ms
- **Medium**: < ${this.options.performanceThresholds.medium}ms  
- **Slow**: < ${this.options.performanceThresholds.slow}ms
- **Very Slow**: ≥ ${this.options.performanceThresholds.slow}ms

## Environment

- **Platform**: ${this.benchmarkResults.metadata.environment.platform}
- **Node.js**: ${this.benchmarkResults.metadata.environment.nodeVersion}
- **ACT Version**: ${this.benchmarkResults.metadata.environment.actVersion}
- **Benchmark Iterations**: ${this.options.benchmarkIterations} per test
- **Generated**: ${this.benchmarkResults.metadata.timestamp}

---
*Generated by ACT Performance Benchmarker v1.0.0*`;
  }

  generateOverallRecommendations() {
    const recommendations = [];
    const avgTime = this.benchmarkResults.summary.averageExecutionTime;
    
    if (avgTime > this.options.performanceThresholds.medium) {
      recommendations.push('Overall workflow performance needs improvement - consider optimization strategies');
    }
    
    if (this.benchmarkResults.summary.failedTests > 0) {
      recommendations.push(`${this.benchmarkResults.summary.failedTests} tests failed - investigate and resolve reliability issues`);
    }
    
    const slowWorkflows = this.benchmarkResults.workflows.filter(w => 
      w.overall.performanceCategory === 'slow' || w.overall.performanceCategory === 'very_slow'
    );
    
    if (slowWorkflows.length > 0) {
      recommendations.push(`${slowWorkflows.length} workflows are performing slowly - prioritize optimization efforts`);
    }
    
    const highComplexityWorkflows = this.benchmarkResults.workflows.filter(w => 
      w.analysis.complexity === 'high'
    );
    
    if (highComplexityWorkflows.length > 0) {
      recommendations.push(`${highComplexityWorkflows.length} workflows have high complexity - consider refactoring`);
    }
    
    // Platform-specific recommendations
    const platforms = Object.entries(this.benchmarkResults.platformComparison);
    if (platforms.length > 1) {
      const fastestPlatform = platforms.reduce((min, [platform, data]) => 
        data.averageExecutionTime < min[1].averageExecutionTime ? [platform, data] : min
      );
      
      recommendations.push(`Consider using ${fastestPlatform[0]} for optimal performance`);
    }
    
    recommendations.push('Implement workflow caching strategies to improve execution times');
    recommendations.push('Monitor performance trends and set up automated alerts for regressions');
    recommendations.push('Regular performance reviews should be part of your development process');
    
    return recommendations;
  }

  // Utility methods
  getCategoryEmoji(category) {
    const emojis = {
      fast: '🟢',
      medium: '🟡', 
      slow: '🟠',
      very_slow: '🔴'
    };
    return emojis[category] || '⚪';
  }

  getRatingEmoji(rating) {
    const emojis = {
      excellent: '🟢',
      good: '🟡',
      needs_improvement: '🔴'
    };
    return emojis[rating] || '⚪';
  }

  getActVersion() {
    try {
      return execSync('act --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'not available';
    }
  }
}

module.exports = ActPerformanceBenchmarker;

// CLI Usage
if (require.main === module) {
  const benchmarker = new ActPerformanceBenchmarker();
  
  (async () => {
    try {
      console.log('⚡ Starting ACT Performance Benchmarking...\n');
      
      await benchmarker.runBenchmarks();
      
      console.log('\n✅ Performance benchmarking completed successfully!');
      console.log(`📊 Average execution time: ${Math.round(benchmarker.benchmarkResults.summary.averageExecutionTime)}ms`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Performance benchmarking failed:', error.message);
      process.exit(1);
    }
  })();
}