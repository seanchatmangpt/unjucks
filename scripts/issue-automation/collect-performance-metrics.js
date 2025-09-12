#!/usr/bin/env node

/**
 * Performance Metrics Collection Script
 * Collects and analyzes performance data from GitHub Actions workflows
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

class PerformanceMetricsCollector {
  constructor(options = {}) {
    this.workflowRunId = options.workflowRunId;
    this.branch = options.branch;
    this.commit = options.commit;
    this.metricsFile = options.metricsFile || 'performance-metrics.json';
  }

  async collect() {
    console.log('📊 Collecting performance metrics...');
    
    const metrics = {
      id: `perf-${this.getDeterministicTimestamp()}`,
      timestamp: this.getDeterministicDate().toISOString(),
      workflow_run_id: this.workflowRunId,
      branch: this.branch,
      commit: this.commit,
      build_metrics: {},
      test_metrics: {},
      dependency_metrics: {},
      workflow_metrics: {},
      system_metrics: {},
      baseline_comparison: {}
    };

    try {
      // Collect build performance metrics
      metrics.build_metrics = await this.collectBuildMetrics();
      
      // Collect test performance metrics
      metrics.test_metrics = await this.collectTestMetrics();
      
      // Collect dependency installation metrics
      metrics.dependency_metrics = await this.collectDependencyMetrics();
      
      // Collect workflow execution metrics
      metrics.workflow_metrics = await this.collectWorkflowMetrics();
      
      // Collect system resource metrics
      metrics.system_metrics = await this.collectSystemMetrics();
      
      // Compare with baseline
      metrics.baseline_comparison = await this.compareWithBaseline(metrics);
      
      // Save metrics
      writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
      
      console.log(`✅ Performance metrics collected and saved to ${this.metricsFile}`);
      return metrics;
      
    } catch (error) {
      console.error('❌ Performance metrics collection error:', error.message);
      
      // Save partial metrics
      writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
      throw error;
    }
  }

  async collectBuildMetrics() {
    console.log('🔨 Collecting build metrics...');
    
    const metrics = {
      duration: 0,
      success: false,
      bundle_size: 0,
      dependency_count: 0,
      compile_time: 0,
      memory_usage: 0
    };

    try {
      // Measure build time
      const buildStart = this.getDeterministicTimestamp();
      
      try {
        execSync('npm run build:validate', { 
          stdio: 'pipe',
          timeout: 300000 // 5 minutes
        });
        metrics.success = true;
      } catch (buildError) {
        metrics.success = false;
        console.warn('Build failed during metrics collection');
      }
      
      metrics.duration = this.getDeterministicTimestamp() - buildStart;
      
      // Analyze bundle size if build succeeded
      if (metrics.success) {
        metrics.bundle_size = this.calculateBundleSize();
      }
      
      // Count dependencies
      metrics.dependency_count = this.countDependencies();
      
      // Estimate memory usage during build
      metrics.memory_usage = this.estimateMemoryUsage();
      
      return metrics;
      
    } catch (error) {
      console.warn('Build metrics collection failed:', error.message);
      return metrics;
    }
  }

  async collectTestMetrics() {
    console.log('🧪 Collecting test metrics...');
    
    const metrics = {
      total_duration: 0,
      test_count: 0,
      pass_count: 0,
      fail_count: 0,
      skip_count: 0,
      coverage_percentage: 0,
      slowest_tests: [],
      memory_usage: 0
    };

    try {
      const testStart = this.getDeterministicTimestamp();
      
      // Run minimal test suite to gather metrics
      try {
        const testOutput = execSync('npm run test:minimal -- --reporter=json', {
          encoding: 'utf8',
          timeout: 180000 // 3 minutes
        });
        
        // Parse test results
        const testResults = JSON.parse(testOutput);
        
        metrics.test_count = testResults.numTotalTests || 0;
        metrics.pass_count = testResults.numPassedTests || 0;
        metrics.fail_count = testResults.numFailedTests || 0;
        metrics.skip_count = testResults.numPendingTests || 0;
        
        // Extract slowest tests
        if (testResults.testResults) {
          const allTests = testResults.testResults.flatMap(suite => 
            suite.assertionResults || []
          );
          
          metrics.slowest_tests = allTests
            .filter(test => test.duration)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
            .map(test => ({
              name: test.title,
              duration: test.duration
            }));
        }
        
      } catch (testError) {
        console.warn('Test execution failed during metrics collection');
      }
      
      metrics.total_duration = this.getDeterministicTimestamp() - testStart;
      
      // Collect coverage if available
      metrics.coverage_percentage = this.extractCoveragePercentage();
      
      return metrics;
      
    } catch (error) {
      console.warn('Test metrics collection failed:', error.message);
      return metrics;
    }
  }

  async collectDependencyMetrics() {
    console.log('📦 Collecting dependency metrics...');
    
    const metrics = {
      install_duration: 0,
      total_dependencies: 0,
      security_vulnerabilities: 0,
      outdated_packages: 0,
      bundle_impact: 0
    };

    try {
      // Measure npm install time
      const installStart = this.getDeterministicTimestamp();
      
      try {
        execSync('npm ci --silent', {
          stdio: 'pipe',
          timeout: 300000 // 5 minutes
        });
      } catch (installError) {
        console.warn('Dependency installation failed during metrics collection');
      }
      
      metrics.install_duration = this.getDeterministicTimestamp() - installStart;
      
      // Count total dependencies
      try {
        const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});
        metrics.total_dependencies = deps.length + devDeps.length;
      } catch (error) {
        console.warn('Could not read package.json');
      }
      
      // Check for security vulnerabilities
      try {
        const auditOutput = execSync('npm audit --json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        const auditResults = JSON.parse(auditOutput);
        metrics.security_vulnerabilities = auditResults.metadata?.vulnerabilities?.total || 0;
      } catch (auditError) {
        // npm audit returns non-zero exit code when vulnerabilities found
        try {
          const auditResults = JSON.parse(auditError.stdout);
          metrics.security_vulnerabilities = auditResults.metadata?.vulnerabilities?.total || 0;
        } catch (parseError) {
          metrics.security_vulnerabilities = 0;
        }
      }
      
      // Check for outdated packages
      try {
        const outdatedOutput = execSync('npm outdated --json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        const outdatedResults = JSON.parse(outdatedOutput);
        metrics.outdated_packages = Object.keys(outdatedResults).length;
      } catch (outdatedError) {
        // npm outdated returns non-zero when packages are outdated
        metrics.outdated_packages = 0;
      }
      
      return metrics;
      
    } catch (error) {
      console.warn('Dependency metrics collection failed:', error.message);
      return metrics;
    }
  }

  async collectWorkflowMetrics() {
    console.log('⚙️ Collecting workflow metrics...');
    
    const metrics = {
      total_jobs: 0,
      successful_jobs: 0,
      failed_jobs: 0,
      average_job_duration: 0,
      queue_time: 0,
      runner_utilization: 0
    };

    if (!this.workflowRunId || this.workflowRunId === 'scheduled') {
      return metrics;
    }

    try {
      // Get workflow run details
      const runDetails = execSync(`gh run view ${this.workflowRunId} --json jobs,status,conclusion,createdAt,updatedAt`, {
        encoding: 'utf8'
      });
      
      const runData = JSON.parse(runDetails);
      
      if (runData.jobs) {
        metrics.total_jobs = runData.jobs.length;
        metrics.successful_jobs = runData.jobs.filter(job => job.conclusion === 'success').length;
        metrics.failed_jobs = runData.jobs.filter(job => job.conclusion === 'failure').length;
        
        // Calculate average job duration
        const jobDurations = runData.jobs
          .filter(job => job.startedAt && job.completedAt)
          .map(job => new Date(job.completedAt) - new Date(job.startedAt));
        
        if (jobDurations.length > 0) {
          metrics.average_job_duration = jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length;
        }
      }
      
      return metrics;
      
    } catch (error) {
      console.warn('Workflow metrics collection failed:', error.message);
      return metrics;
    }
  }

  async collectSystemMetrics() {
    console.log('💻 Collecting system metrics...');
    
    const metrics = {
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      network_latency: 0,
      runner_os: process.platform,
      node_version: process.version
    };

    try {
      // Get CPU usage
      const cpuUsage = process.cpuUsage();
      metrics.cpu_usage = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
      
      // Get memory usage
      const memUsage = process.memoryUsage();
      metrics.memory_usage = memUsage.heapUsed / 1024 / 1024; // Convert to MB
      
      // Get disk usage for current directory
      try {
        const diskUsage = execSync('du -sm .', { encoding: 'utf8' });
        metrics.disk_usage = parseInt(diskUsage.split('\t')[0]);
      } catch (diskError) {
        metrics.disk_usage = 0;
      }
      
      // Measure network latency to GitHub API
      try {
        const latencyStart = this.getDeterministicTimestamp();
        execSync('curl -s -o /dev/null https://api.github.com', { timeout: 10000 });
        metrics.network_latency = this.getDeterministicTimestamp() - latencyStart;
      } catch (networkError) {
        metrics.network_latency = 0;
      }
      
      return metrics;
      
    } catch (error) {
      console.warn('System metrics collection failed:', error.message);
      return metrics;
    }
  }

  async compareWithBaseline(currentMetrics) {
    console.log('📈 Comparing with performance baseline...');
    
    const comparison = {
      baseline_exists: false,
      build_duration_change: 0,
      test_duration_change: 0,
      dependency_install_change: 0,
      memory_usage_change: 0,
      regression_detected: false,
      improvements_detected: false
    };

    try {
      const baselinePath = 'scripts/performance-baselines.json';
      
      if (!existsSync(baselinePath)) {
        console.log('No performance baseline found, creating initial baseline');
        this.createInitialBaseline(currentMetrics);
        return comparison;
      }
      
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
      comparison.baseline_exists = true;
      
      // Compare build duration
      if (baseline.build_metrics?.duration && currentMetrics.build_metrics?.duration) {
        comparison.build_duration_change = 
          ((currentMetrics.build_metrics.duration - baseline.build_metrics.duration) / baseline.build_metrics.duration) * 100;
      }
      
      // Compare test duration
      if (baseline.test_metrics?.total_duration && currentMetrics.test_metrics?.total_duration) {
        comparison.test_duration_change = 
          ((currentMetrics.test_metrics.total_duration - baseline.test_metrics.total_duration) / baseline.test_metrics.total_duration) * 100;
      }
      
      // Compare dependency install time
      if (baseline.dependency_metrics?.install_duration && currentMetrics.dependency_metrics?.install_duration) {
        comparison.dependency_install_change = 
          ((currentMetrics.dependency_metrics.install_duration - baseline.dependency_metrics.install_duration) / baseline.dependency_metrics.install_duration) * 100;
      }
      
      // Compare memory usage
      if (baseline.system_metrics?.memory_usage && currentMetrics.system_metrics?.memory_usage) {
        comparison.memory_usage_change = 
          ((currentMetrics.system_metrics.memory_usage - baseline.system_metrics.memory_usage) / baseline.system_metrics.memory_usage) * 100;
      }
      
      // Detect regressions (>20% increase in duration/memory)
      const regressionThreshold = 20;
      comparison.regression_detected = 
        Math.abs(comparison.build_duration_change) > regressionThreshold ||
        Math.abs(comparison.test_duration_change) > regressionThreshold ||
        Math.abs(comparison.dependency_install_change) > regressionThreshold ||
        Math.abs(comparison.memory_usage_change) > regressionThreshold;
      
      // Detect improvements (>10% decrease in duration/memory)
      const improvementThreshold = -10;
      comparison.improvements_detected = 
        comparison.build_duration_change < improvementThreshold ||
        comparison.test_duration_change < improvementThreshold ||
        comparison.dependency_install_change < improvementThreshold ||
        comparison.memory_usage_change < improvementThreshold;
      
      return comparison;
      
    } catch (error) {
      console.warn('Baseline comparison failed:', error.message);
      return comparison;
    }
  }

  calculateBundleSize() {
    try {
      // Estimate bundle size from built artifacts
      const bundleSize = execSync('find . -name "*.js" -not -path "./node_modules/*" -exec wc -c {} + | tail -1', {
        encoding: 'utf8'
      });
      
      return parseInt(bundleSize.trim().split(/\s+/)[0]) || 0;
    } catch (error) {
      return 0;
    }
  }

  countDependencies() {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      return deps.length + devDeps.length;
    } catch (error) {
      return 0;
    }
  }

  estimateMemoryUsage() {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / 1024 / 1024; // Convert to MB
  }

  extractCoveragePercentage() {
    try {
      // Try to read coverage summary if it exists
      if (existsSync('coverage/coverage-summary.json')) {
        const coverageSummary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
        return coverageSummary.total?.lines?.pct || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  createInitialBaseline(metrics) {
    const baselinePath = 'scripts/performance-baselines.json';
    const baseline = {
      created: this.getDeterministicDate().toISOString(),
      last_updated: this.getDeterministicDate().toISOString(),
      ...metrics
    };
    
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`✅ Initial performance baseline created at ${baselinePath}`);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '').replace(/-/g, '_');
    const value = args[i + 1];
    options[key] = value;
  }
  
  const collector = new PerformanceMetricsCollector(options);
  collector.collect().catch(console.error);
}

export { PerformanceMetricsCollector };