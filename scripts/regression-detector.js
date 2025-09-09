#!/usr/bin/env node

/**
 * Regression Detector - Monitors for regressions in key system components
 * Focuses on SPARQL, JSON, templates, exports, and security systems
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Define critical system components to monitor
const REGRESSION_TARGETS = {
  sparql: {
    description: 'SPARQL query processing and validation',
    testFiles: [
      'tests/fixtures/sparql/*.test.js',
      'tests/integration/*sparql*.test.js',
      'tests/unit/*sparql*.test.js'
    ],
    criticalFunctions: [
      'parseSPARQLQuery',
      'validateSPARQL',
      'constructQuery',
      'selectQuery',
      'updateQuery'
    ],
    baseline: null
  },
  
  json: {
    description: 'JSON processing and validation',
    testFiles: [
      'tests/unit/*json*.test.js',
      'tests/integration/*json*.test.js'
    ],
    criticalFunctions: [
      'parseJSON',
      'validateJSON',
      'jsonToRDF',
      'processJSONLD'
    ],
    baseline: null
  },
  
  templates: {
    description: 'Template rendering and injection',
    testFiles: [
      'tests/unit/template*.test.js',
      'tests/integration/template*.test.js',
      'tests/*template*.test.js'
    ],
    criticalFunctions: [
      'renderTemplate',
      'injectContent',
      'parseTemplate',
      'extractVariables'
    ],
    baseline: null
  },
  
  exports: {
    description: 'Export functionality (PDF, DOCX, LaTeX)',
    testFiles: [
      'tests/unit/*export*.test.js',
      'tests/integration/*export*.test.js'
    ],
    criticalFunctions: [
      'exportToPDF',
      'exportToDOCX',
      'exportToLaTeX',
      'processExport'
    ],
    baseline: null
  },
  
  security: {
    description: 'Security filters and validation',
    testFiles: [
      'tests/security/*.test.js',
      'tests/unit/*security*.test.js'
    ],
    criticalFunctions: [
      'sanitizeInput',
      'validateInput',
      'escapeHTML',
      'filterMalicious'
    ],
    baseline: null
  },
  
  rdf: {
    description: 'RDF/Turtle processing',
    testFiles: [
      'tests/unit/*rdf*.test.js',
      'tests/unit/*turtle*.test.js',
      'tests/integration/*rdf*.test.js'
    ],
    criticalFunctions: [
      'parseTurtle',
      'validateRDF',
      'transformRDF',
      'processTriples'
    ],
    baseline: null
  }
};

class RegressionDetector {
  constructor(options = {}) {
    this.baseline = options.baseline;
    this.threshold = options.threshold || 0.05; // 5% degradation threshold
    this.results = {
      timestamp: new Date().toISOString(),
      targets: {},
      regressions: [],
      improvements: [],
      summary: {}
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = ['reports', 'reports/regression', 'reports/baselines'];
    dirs.forEach(dir => {
      const fullPath = join(rootDir, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async loadBaseline() {
    console.log('📊 Loading regression detection baseline...');
    
    const baselineFile = join(rootDir, 'reports', 'baselines', 'regression-baseline.json');
    
    if (existsSync(baselineFile)) {
      try {
        this.baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
        console.log(`✅ Loaded baseline from ${baselineFile}`);
        return true;
      } catch (error) {
        console.log(`⚠️  Could not load baseline: ${error.message}`);
      }
    }
    
    console.log('📝 No baseline found, creating new baseline...');
    return false;
  }

  async runTargetTests(targetName, target) {
    console.log(`\n🎯 Testing ${targetName}: ${target.description}`);
    
    const results = {
      target: targetName,
      description: target.description,
      testFiles: target.testFiles,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      performance: {
        averageTime: 0,
        maxTime: 0,
        minTime: Infinity
      },
      errors: [],
      warnings: []
    };

    // Build test command for this target
    const testPatterns = target.testFiles.map(pattern => 
      pattern.replace('*', '**')
    ).join(' ');

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const testProcess = spawn('npx', [
        'vitest', 'run',
        '--config', 'vitest.ci.config.js',
        '--reporter=json',
        `--outputFile=reports/regression/${targetName}-results.json`,
        ...target.testFiles.map(f => f.replace('*', '**'))
      ], {
        cwd: rootDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true',
          REGRESSION_TARGET: targetName
        }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        results.duration = Date.now() - startTime;
        results.endTime = new Date();
        
        // Parse test results
        try {
          const resultsFile = join(rootDir, 'reports', 'regression', `${targetName}-results.json`);
          if (existsSync(resultsFile)) {
            const testData = JSON.parse(readFileSync(resultsFile, 'utf8'));
            
            results.tests.total = testData.numTotalTests || 0;
            results.tests.passed = testData.numPassedTests || 0;
            results.tests.failed = testData.numFailedTests || 0;
            results.tests.skipped = testData.numPendingTests || 0;
            
            // Calculate performance metrics
            if (testData.testResults && testData.testResults.length > 0) {
              const times = testData.testResults
                .filter(t => t.duration)
                .map(t => t.duration);
              
              if (times.length > 0) {
                results.performance.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
                results.performance.maxTime = Math.max(...times);
                results.performance.minTime = Math.min(...times);
              }
            }
            
            // Extract errors and warnings
            if (testData.testResults) {
              testData.testResults.forEach(test => {
                if (test.status === 'failed') {
                  results.errors.push({
                    test: test.name || test.title,
                    message: test.message,
                    stack: test.stack
                  });
                }
              });
            }
          }
        } catch (error) {
          console.log(`⚠️  Could not parse results for ${targetName}: ${error.message}`);
        }

        const successRate = results.tests.total > 0 
          ? (results.tests.passed / results.tests.total)
          : 0;

        console.log(`   ${successRate >= 0.8 ? '✅' : '❌'} ${targetName}: ${results.tests.passed}/${results.tests.total} passed (${(successRate * 100).toFixed(1)}%)`);
        
        resolve(results);
      });

      testProcess.on('error', (error) => {
        console.log(`💥 ${targetName} test process error:`, error);
        results.errors.push({
          type: 'process_error',
          message: error.message
        });
        resolve(results);
      });

      // 5 minute timeout per target
      setTimeout(() => {
        testProcess.kill('SIGKILL');
        results.errors.push({
          type: 'timeout',
          message: 'Test execution timed out'
        });
        resolve(results);
      }, 300000);
    });
  }

  async detectRegressions() {
    console.log('\n🔍 Running regression detection for critical systems...\n');
    
    // Test each target
    for (const [targetName, target] of Object.entries(REGRESSION_TARGETS)) {
      try {
        const results = await this.runTargetTests(targetName, target);
        this.results.targets[targetName] = results;
        
        // Compare with baseline if available
        if (this.baseline && this.baseline.targets && this.baseline.targets[targetName]) {
          this.compareWithBaseline(targetName, results, this.baseline.targets[targetName]);
        }
        
      } catch (error) {
        console.log(`💥 Error testing ${targetName}:`, error);
        this.results.targets[targetName] = {
          target: targetName,
          error: error.message,
          failed: true
        };
      }
    }
  }

  compareWithBaseline(targetName, current, baseline) {
    console.log(`📊 Comparing ${targetName} with baseline...`);
    
    const currentSuccessRate = current.tests.total > 0 
      ? (current.tests.passed / current.tests.total)
      : 0;
    
    const baselineSuccessRate = baseline.tests.total > 0 
      ? (baseline.tests.passed / baseline.tests.total)
      : 0;
    
    const successRateDiff = currentSuccessRate - baselineSuccessRate;
    const performanceDiff = current.performance.averageTime - baseline.performance.averageTime;
    const performanceRatio = baseline.performance.averageTime > 0 
      ? (performanceDiff / baseline.performance.averageTime)
      : 0;

    const comparison = {
      target: targetName,
      current: {
        successRate: currentSuccessRate,
        averageTime: current.performance.averageTime,
        totalTests: current.tests.total
      },
      baseline: {
        successRate: baselineSuccessRate,
        averageTime: baseline.performance.averageTime,
        totalTests: baseline.tests.total
      },
      diff: {
        successRate: successRateDiff,
        performance: performanceDiff,
        performanceRatio: performanceRatio
      }
    };

    // Detect regressions
    if (successRateDiff < -this.threshold) {
      this.results.regressions.push({
        ...comparison,
        type: 'success_rate_regression',
        severity: successRateDiff < -0.1 ? 'critical' : 'moderate',
        message: `Success rate dropped by ${Math.abs(successRateDiff * 100).toFixed(1)}%`
      });
      console.log(`   🚨 REGRESSION: Success rate dropped from ${(baselineSuccessRate * 100).toFixed(1)}% to ${(currentSuccessRate * 100).toFixed(1)}%`);
    }

    if (performanceRatio > this.threshold && performanceDiff > 100) {
      this.results.regressions.push({
        ...comparison,
        type: 'performance_regression',
        severity: performanceRatio > 0.2 ? 'critical' : 'moderate',
        message: `Performance degraded by ${(performanceRatio * 100).toFixed(1)}%`
      });
      console.log(`   🐌 PERFORMANCE REGRESSION: Average time increased by ${performanceDiff.toFixed(0)}ms`);
    }

    // Detect improvements
    if (successRateDiff > this.threshold) {
      this.results.improvements.push({
        ...comparison,
        type: 'success_rate_improvement',
        message: `Success rate improved by ${(successRateDiff * 100).toFixed(1)}%`
      });
      console.log(`   ✨ IMPROVEMENT: Success rate improved from ${(baselineSuccessRate * 100).toFixed(1)}% to ${(currentSuccessRate * 100).toFixed(1)}%`);
    }

    if (performanceRatio < -this.threshold && Math.abs(performanceDiff) > 100) {
      this.results.improvements.push({
        ...comparison,
        type: 'performance_improvement', 
        message: `Performance improved by ${Math.abs(performanceRatio * 100).toFixed(1)}%`
      });
      console.log(`   🚀 PERFORMANCE IMPROVEMENT: Average time decreased by ${Math.abs(performanceDiff).toFixed(0)}ms`);
    }
  }

  generateSummary() {
    const totalTargets = Object.keys(this.results.targets).length;
    const failedTargets = Object.values(this.results.targets).filter(t => t.failed || t.tests.failed > 0).length;
    const passedTargets = totalTargets - failedTargets;

    this.results.summary = {
      totalTargets,
      passedTargets,
      failedTargets,
      regressionCount: this.results.regressions.length,
      improvementCount: this.results.improvements.length,
      criticalRegressions: this.results.regressions.filter(r => r.severity === 'critical').length,
      overallStatus: this.results.regressions.length === 0 ? 'clean' : 
                    this.results.regressions.filter(r => r.severity === 'critical').length > 0 ? 'critical' : 'warning'
    };
  }

  async saveResults() {
    console.log('\n💾 Saving regression detection results...');
    
    this.generateSummary();
    
    // Save detailed results
    const resultsFile = join(rootDir, 'reports', 'regression', 'regression-results.json');
    writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    // Save as new baseline if no critical regressions
    if (this.results.summary.criticalRegressions === 0) {
      const baselineFile = join(rootDir, 'reports', 'baselines', 'regression-baseline.json');
      writeFileSync(baselineFile, JSON.stringify(this.results, null, 2));
      console.log(`✅ Saved new baseline to ${baselineFile}`);
    }
    
    // Generate markdown report
    const reportMd = this.generateMarkdownReport();
    const reportFile = join(rootDir, 'reports', 'regression', 'regression-report.md');
    writeFileSync(reportFile, reportMd);
    
    console.log(`📊 Results saved to ${resultsFile}`);
    console.log(`📝 Report saved to ${reportFile}`);
  }

  generateMarkdownReport() {
    const md = [];
    
    md.push('# 🔍 Regression Detection Report');
    md.push('');
    md.push(`**Generated:** ${this.results.timestamp}`);
    md.push(`**Status:** ${this.results.summary.overallStatus.toUpperCase()}`);
    md.push('');
    
    md.push('## 📊 Summary');
    md.push('');
    md.push(`- **Total Targets:** ${this.results.summary.totalTargets}`);
    md.push(`- **Passed:** ${this.results.summary.passedTargets}`);
    md.push(`- **Failed:** ${this.results.summary.failedTargets}`);
    md.push(`- **Regressions:** ${this.results.summary.regressionCount} (${this.results.summary.criticalRegressions} critical)`);
    md.push(`- **Improvements:** ${this.results.summary.improvementCount}`);
    md.push('');
    
    if (this.results.regressions.length > 0) {
      md.push('## 🚨 Regressions Detected');
      md.push('');
      this.results.regressions.forEach(regression => {
        md.push(`### ${regression.target} (${regression.severity})`);
        md.push(`**Type:** ${regression.type}`);
        md.push(`**Message:** ${regression.message}`);
        md.push('');
        md.push('**Current vs Baseline:**');
        md.push(`- Success Rate: ${(regression.current.successRate * 100).toFixed(1)}% → ${(regression.baseline.successRate * 100).toFixed(1)}%`);
        md.push(`- Average Time: ${regression.current.averageTime.toFixed(0)}ms → ${regression.baseline.averageTime.toFixed(0)}ms`);
        md.push('');
      });
    }
    
    if (this.results.improvements.length > 0) {
      md.push('## ✨ Improvements Detected');
      md.push('');
      this.results.improvements.forEach(improvement => {
        md.push(`### ${improvement.target}`);
        md.push(`**Type:** ${improvement.type}`);
        md.push(`**Message:** ${improvement.message}`);
        md.push('');
      });
    }
    
    md.push('## 🎯 Target Details');
    md.push('');
    Object.values(this.results.targets).forEach(target => {
      if (!target.failed) {
        md.push(`### ${target.target}`);
        md.push(`**Description:** ${target.description}`);
        md.push(`**Tests:** ${target.tests.passed}/${target.tests.total} passed`);
        md.push(`**Duration:** ${target.duration}ms`);
        md.push(`**Average Test Time:** ${target.performance.averageTime.toFixed(0)}ms`);
        
        if (target.errors.length > 0) {
          md.push('**Errors:**');
          target.errors.slice(0, 3).forEach(error => {
            md.push(`- ${error.test || error.type}: ${error.message}`);
          });
        }
        md.push('');
      }
    });
    
    return md.join('\n');
  }

  printSummary() {
    console.log('\n🔍 REGRESSION DETECTION SUMMARY');
    console.log('================================');
    console.log(`Status: ${this.results.summary.overallStatus.toUpperCase()}`);
    console.log(`Targets: ${this.results.summary.passedTargets}/${this.results.summary.totalTargets} passed`);
    console.log(`Regressions: ${this.results.summary.regressionCount} (${this.results.summary.criticalRegressions} critical)`);
    console.log(`Improvements: ${this.results.summary.improvementCount}`);
    console.log('');
    
    if (this.results.regressions.length > 0) {
      console.log('🚨 REGRESSIONS:');
      this.results.regressions.forEach(reg => {
        console.log(`  - ${reg.target}: ${reg.message} (${reg.severity})`);
      });
      console.log('');
    }
    
    if (this.results.improvements.length > 0) {
      console.log('✨ IMPROVEMENTS:');
      this.results.improvements.forEach(imp => {
        console.log(`  - ${imp.target}: ${imp.message}`);
      });
      console.log('');
    }
    
    if (this.results.summary.overallStatus === 'clean') {
      console.log('✅ No regressions detected!');
    }
  }

  async run() {
    console.log('\n🔍 Starting regression detection for critical systems\n');
    
    try {
      await this.loadBaseline();
      await this.detectRegressions();
      await this.saveResults();
      this.printSummary();
      
      console.log('\n🎉 Regression detection completed');
      
      return {
        success: true,
        results: this.results,
        exitCode: this.results.summary.criticalRegressions > 0 ? 2 : 
                  this.results.summary.regressionCount > 0 ? 1 : 0
      };
      
    } catch (error) {
      console.error('\n💥 Regression detection failed:', error);
      
      return {
        success: false,
        error: error.message,
        exitCode: 3
      };
    }
  }
}

// CLI interface
async function main() {
  const detector = new RegressionDetector();
  const result = await detector.run();
  
  process.exit(result.exitCode);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RegressionDetector };