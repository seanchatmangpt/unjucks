#!/usr/bin/env node

/**
 * Code Coverage Monitoring System
 * Tracks coverage metrics and enforces thresholds
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class CoverageMonitor {
  constructor(config = {}) {
    this.config = {
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
        ...config.thresholds
      },
      reportFormats: ['json', 'lcov', 'html', 'text'],
      outputDir: 'tests/coverage',
      ...config
    };
  }

  async runCoverage() {
    console.log('📋 Running Code Coverage Analysis...');
    
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Run tests with coverage
      const result = await this.executeCoverageCommand();
      const coverage = await this.parseCoverageReport();
      
      const report = {
        timestamp: this.getDeterministicDate().toISOString(),
        duration: this.getDeterministicTimestamp() - startTime,
        coverage,
        thresholds: this.config.thresholds,
        passed: this.validateThresholds(coverage),
        files: coverage.files || []
      };
      
      await this.saveCoverageReport(report);
      await this.generateCoverageAnalytics(report);
      
      this.displayCoverageResults(report);
      
      return report;
    } catch (error) {
      console.error('💥 Coverage analysis failed:', error.message);
      throw error;
    }
  }

  async executeCoverageCommand() {
    return new Promise((resolve, reject) => {
      // Use c8 for coverage since it's in devDependencies
      const process = spawn('npx', ['c8', '--reporter=json', '--reporter=text', '--reporter=html', 'npm', 'test'], {
        cwd: projectRoot,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        // Show real-time output
        console.log(data.toString());
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject(new Error(`Coverage command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  async parseCoverageReport() {
    const coverageFile = path.join(projectRoot, 'coverage/coverage-final.json');
    
    if (!await fs.pathExists(coverageFile)) {
      // Fallback to manual parsing if coverage file doesn't exist
      return this.estimateCoverage();
    }
    
    const coverageData = await fs.readJSON(coverageFile);
    
    // Calculate overall metrics
    let totalStatements = 0, coveredStatements = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalLines = 0, coveredLines = 0;
    
    const files = [];
    
    Object.entries(coverageData).forEach(([filename, data]) => {
      if (filename.includes('node_modules')) return;
      
      const statements = data.s || {};
      const branches = data.b || {};
      const functions = data.f || {};
      
      const fileStats = {
        path: filename.replace(projectRoot, ''),
        statements: this.calculateCoverage(statements),
        branches: this.calculateBranchCoverage(branches),
        functions: this.calculateCoverage(functions),
        lines: this.calculateLineCoverage(data.statementMap, statements)
      };
      
      files.push(fileStats);
      
      totalStatements += Object.keys(statements).length;
      coveredStatements += Object.values(statements).filter(count => count > 0).length;
      
      totalFunctions += Object.keys(functions).length;
      coveredFunctions += Object.values(functions).filter(count => count > 0).length;
    });
    
    return {
      statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
      functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      files
    };
  }

  calculateCoverage(items) {
    const total = Object.keys(items).length;
    const covered = Object.values(items).filter(count => count > 0).length;
    return total > 0 ? (covered / total) * 100 : 0;
  }

  calculateBranchCoverage(branches) {
    let total = 0, covered = 0;
    Object.values(branches).forEach(branch => {
      if (Array.isArray(branch)) {
        total += branch.length;
        covered += branch.filter(count => count > 0).length;
      }
    });
    return total > 0 ? (covered / total) * 100 : 0;
  }

  calculateLineCoverage(statementMap, statements) {
    const lines = new Set();
    Object.keys(statements).forEach(key => {
      if (statementMap[key] && statementMap[key].start) {
        lines.add(statementMap[key].start.line);
      }
    });
    
    const coveredLines = Object.keys(statements)
      .filter(key => statements[key] > 0)
      .map(key => statementMap[key]?.start?.line)
      .filter(Boolean);
    
    return lines.size > 0 ? (new Set(coveredLines).size / lines.size) * 100 : 0;
  }

  async estimateCoverage() {
    // Fallback estimation based on test files vs source files
    const srcFiles = await this.countFiles('src/**/*.js');
    const testFiles = await this.countFiles('tests/**/*.js');
    
    const estimated = Math.min(90, (testFiles / srcFiles) * 100);
    
    return {
      statements: estimated,
      branches: estimated * 0.8,
      functions: estimated * 0.9,
      lines: estimated,
      estimated: true,
      files: []
    };
  }

  async countFiles(pattern) {
    const { glob } = await import('glob');
    const files = await glob(pattern, { cwd: projectRoot });
    return files.length;
  }

  validateThresholds(coverage) {
    const results = {};
    
    Object.entries(this.config.thresholds).forEach(([metric, threshold]) => {
      results[metric] = coverage[metric] >= threshold;
    });
    
    return {
      overall: Object.values(results).every(Boolean),
      details: results
    };
  }

  async saveCoverageReport(report) {
    const reportsDir = path.join(projectRoot, 'tests/reports');
    await fs.ensureDir(reportsDir);
    
    // Save current report
    await fs.writeJSON(
      path.join(reportsDir, 'coverage-report.json'),
      report,
      { spaces: 2 }
    );
    
    // Save historical data
    const historyFile = path.join(reportsDir, 'coverage-history.json');
    let history = [];
    
    if (await fs.pathExists(historyFile)) {
      history = await fs.readJSON(historyFile);
    }
    
    history.push({
      timestamp: report.timestamp,
      coverage: report.coverage,
      passed: report.passed.overall
    });
    
    // Keep last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    await fs.writeJSON(historyFile, history, { spaces: 2 });
  }

  async generateCoverageAnalytics(report) {
    const analytics = {
      trends: await this.calculateTrends(),
      uncoveredFiles: report.files
        .filter(file => file.statements < this.config.thresholds.statements)
        .sort((a, b) => a.statements - b.statements),
      topCoveredFiles: report.files
        .filter(file => file.statements >= 90)
        .sort((a, b) => b.statements - a.statements),
      recommendations: this.generateRecommendations(report)
    };
    
    await fs.writeJSON(
      path.join(projectRoot, 'tests/reports/coverage-analytics.json'),
      analytics,
      { spaces: 2 }
    );
  }

  async calculateTrends() {
    const historyFile = path.join(projectRoot, 'tests/reports/coverage-history.json');
    
    if (!await fs.pathExists(historyFile)) {
      return { trend: 'no-data', change: 0 };
    }
    
    const history = await fs.readJSON(historyFile);
    if (history.length < 2) {
      return { trend: 'insufficient-data', change: 0 };
    }
    
    const recent = history.slice(-5); // Last 5 runs
    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    
    const change = current.coverage.statements - previous.coverage.statements;
    
    return {
      trend: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
      change: Math.round(change * 100) / 100,
      history: recent
    };
  }

  generateRecommendations(report) {
    const recommendations = [];
    
    if (!report.passed.overall) {
      recommendations.push('Coverage below thresholds - focus on increasing test coverage');
    }
    
    if (report.coverage.branches < report.coverage.statements) {
      recommendations.push('Branch coverage is low - add tests for conditional logic');
    }
    
    if (report.files.length > 0) {
      const uncoveredCount = report.files.filter(f => f.statements < 80).length;
      if (uncoveredCount > 0) {
        recommendations.push(`${uncoveredCount} files have low coverage - prioritize testing these files`);
      }
    }
    
    return recommendations;
  }

  displayCoverageResults(report) {
    console.log('\n📊 Coverage Results:');
    console.log('=' * 40);
    
    Object.entries(report.coverage).forEach(([metric, value]) => {
      if (typeof value === 'number') {
        const threshold = this.config.thresholds[metric];
        const status = value >= threshold ? '✅' : '❌';
        const color = value >= threshold ? '\x1b[32m' : '\x1b[31m';
        console.log(`${status} ${metric.padEnd(12)}: ${color}${value.toFixed(1)}%\x1b[0m (threshold: ${threshold}%)`);
      }
    });
    
    if (report.coverage.estimated) {
      console.log('\n⚠️  Coverage data estimated (no coverage report found)');
    }
    
    console.log(`\n📁 Files analyzed: ${report.files.length}`);
    console.log(`⏱️  Analysis time: ${report.duration}ms`);
    
    if (!report.passed.overall) {
      console.log('\n💥 Coverage thresholds not met!');
      process.exit(1);
    } else {
      console.log('\n🎉 All coverage thresholds met!');
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const monitor = new CoverageMonitor();
  
  monitor.runCoverage().catch(error => {
    console.error('Coverage monitoring failed:', error);
    process.exit(1);
  });
}

export { CoverageMonitor };
