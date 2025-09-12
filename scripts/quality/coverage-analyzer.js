#!/usr/bin/env node

/**
 * Code Coverage Analyzer and Reporter
 * Comprehensive test coverage analysis with quality thresholds
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';

/**
 * Run coverage analysis using c8
 * @param {Object} options - Coverage options
 * @returns {Promise<Object>} Coverage results
 */
async function runCoverageAnalysis(options = {}) {
  const {
    testCommand = 'npm test',
    outputDir = 'coverage',
    threshold = { lines: 80, functions: 80, branches: 70, statements: 80 },
    exclude = ['**/tests/**', '**/*.test.js', '**/*.spec.js', '**/node_modules/**', '**/coverage/**']
  } = options;
  
  console.log(chalk.blue('☂️ Running code coverage analysis...\n'));
  
  try {
    // Ensure coverage directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Build c8 command
    const c8Args = [
      '--reporter=json',
      '--reporter=text',
      '--reporter=html',
      '--reporter=lcov',
      `--reports-dir=${outputDir}`,
      '--include=src/**',
      ...exclude.map(pattern => `--exclude=${pattern}`),
      '--clean',
      '--all'
    ];
    
    // Add threshold checks
    if (threshold.lines) c8Args.push(`--lines=${threshold.lines}`);
    if (threshold.functions) c8Args.push(`--functions=${threshold.functions}`);
    if (threshold.branches) c8Args.push(`--branches=${threshold.branches}`);
    if (threshold.statements) c8Args.push(`--statements=${threshold.statements}`);
    
    // Split test command
    const [command, ...args] = testCommand.split(' ');
    c8Args.push(command, ...args);
    
    console.log(chalk.gray(`Running: c8 ${c8Args.join(' ')}\n`));
    
    // Execute coverage analysis
    const result = await new Promise((resolve, reject) => {
      const c8Process = spawn('npx', ['c8', ...c8Args], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      c8Process.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      c8Process.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      c8Process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      c8Process.on('error', reject);
    });
    
    // Read coverage results
    const coverageData = await readCoverageResults(outputDir);
    
    return {
      success: result.code === 0,
      exitCode: result.code,
      coverage: coverageData,
      output: result.stdout,
      errors: result.stderr
    };
    
  } catch (error) {
    console.error(chalk.red('❌ Coverage analysis failed:'), error.message);
    throw error;
  }
}

/**
 * Read and parse coverage results
 * @param {string} outputDir - Coverage output directory
 * @returns {Promise<Object>} Parsed coverage data
 */
async function readCoverageResults(outputDir) {
  try {
    // Read JSON coverage report
    const jsonPath = path.join(outputDir, 'coverage-final.json');
    const summaryPath = path.join(outputDir, 'coverage-summary.json');
    
    let coverageData = {};
    let summaryData = {};
    
    // Try to read detailed coverage data
    try {
      const jsonContent = await fs.readFile(jsonPath, 'utf8');
      coverageData = JSON.parse(jsonContent);
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not read detailed coverage data'));
    }
    
    // Try to read summary data
    try {
      const summaryContent = await fs.readFile(summaryPath, 'utf8');
      summaryData = JSON.parse(summaryContent);
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not read coverage summary'));
    }
    
    return {
      detailed: coverageData,
      summary: summaryData,
      timestamp: this.getDeterministicDate().toISOString()
    };
    
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not parse coverage results:'), error.message);
    return null;
  }
}

/**
 * Analyze coverage quality and generate insights
 * @param {Object} coverageData - Coverage data
 * @param {Object} thresholds - Coverage thresholds
 * @returns {Object} Coverage analysis
 */
function analyzeCoverageQuality(coverageData, thresholds = {}) {
  if (!coverageData || !coverageData.summary) {
    return {
      grade: 'F',
      issues: ['No coverage data available'],
      recommendations: ['Run tests with coverage enabled']
    };
  }
  
  const { summary } = coverageData;
  const total = summary.total || {};
  
  const metrics = {
    lines: total.lines?.pct || 0,
    functions: total.functions?.pct || 0,
    branches: total.branches?.pct || 0,
    statements: total.statements?.pct || 0
  };
  
  // Calculate overall coverage score
  const weights = { lines: 0.3, functions: 0.25, branches: 0.25, statements: 0.2 };
  const overallScore = Object.entries(metrics).reduce((score, [key, value]) => {
    return score + (value * weights[key]);
  }, 0);
  
  // Determine grade
  let grade = 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  
  // Identify issues
  const issues = [];
  const recommendations = [];
  
  if (metrics.lines < (thresholds.lines || 80)) {
    issues.push(`Line coverage ${metrics.lines}% below threshold ${thresholds.lines || 80}%`);
    recommendations.push('Add more unit tests to cover untested lines');
  }
  
  if (metrics.functions < (thresholds.functions || 80)) {
    issues.push(`Function coverage ${metrics.functions}% below threshold ${thresholds.functions || 80}%`);
    recommendations.push('Write tests for uncovered functions');
  }
  
  if (metrics.branches < (thresholds.branches || 70)) {
    issues.push(`Branch coverage ${metrics.branches}% below threshold ${thresholds.branches || 70}%`);
    recommendations.push('Add tests for conditional logic and edge cases');
  }
  
  if (metrics.statements < (thresholds.statements || 80)) {
    issues.push(`Statement coverage ${metrics.statements}% below threshold ${thresholds.statements || 80}%`);
    recommendations.push('Increase test coverage for all code statements');
  }
  
  // Add specific recommendations based on coverage patterns
  if (metrics.branches < metrics.lines - 15) {
    recommendations.push('Focus on testing conditional branches and error paths');
  }
  
  if (metrics.functions < metrics.lines - 10) {
    recommendations.push('Ensure all exported functions have dedicated tests');
  }
  
  if (overallScore < 50) {
    recommendations.push('Consider test-driven development (TDD) approach');
    recommendations.push('Set up continuous integration with coverage reporting');
  }
  
  return {
    grade,
    overallScore: Math.round(overallScore * 100) / 100,
    metrics,
    issues,
    recommendations,
    qualityLevel: getQualityLevel(overallScore)
  };
}

/**
 * Get quality level based on coverage score
 * @param {number} score - Coverage score
 * @returns {string} Quality level
 */
function getQualityLevel(score) {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GOOD';
  if (score >= 70) return 'FAIR';
  if (score >= 60) return 'POOR';
  return 'CRITICAL';
}

/**
 * Generate coverage report
 * @param {Object} analysisResult - Coverage analysis result
 * @param {Object} options - Report options
 */
function generateCoverageReport(analysisResult, options = {}) {
  const { outputPath = null, format = 'console' } = options;
  
  console.log(chalk.blue.bold('\n☂️ Code Coverage Analysis Report\n'));
  
  if (!analysisResult.success) {
    console.log(chalk.red.bold('❌ Coverage Analysis Failed'));
    console.log(chalk.red(`Exit Code: ${analysisResult.exitCode}`));
    if (analysisResult.errors) {
      console.log(chalk.red('Errors:'));
      console.log(analysisResult.errors);
    }
    return;
  }
  
  const coverage = analysisResult.coverage;
  if (!coverage) {
    console.log(chalk.yellow('⚠️  No coverage data available'));
    return;
  }
  
  const analysis = analyzeCoverageQuality(coverage);
  
  // Summary
  console.log(chalk.yellow.bold('📊 Summary:'));
  console.log(`   Overall Score: ${analysis.overallScore}%`);
  console.log(`   Quality Grade: ${getGradeColor(analysis.grade)(analysis.grade)}`);
  console.log(`   Quality Level: ${getQualityLevelColor(analysis.qualityLevel)(analysis.qualityLevel)}`);
  console.log();
  
  // Detailed metrics
  console.log(chalk.yellow.bold('📈 Coverage Metrics:'));
  console.log(`   Lines: ${getCoverageColor(analysis.metrics.lines)}${analysis.metrics.lines}%`);
  console.log(`   Functions: ${getCoverageColor(analysis.metrics.functions)}${analysis.metrics.functions}%`);
  console.log(`   Branches: ${getCoverageColor(analysis.metrics.branches)}${analysis.metrics.branches}%`);
  console.log(`   Statements: ${getCoverageColor(analysis.metrics.statements)}${analysis.metrics.statements}%`);
  console.log();
  
  // Issues
  if (analysis.issues.length > 0) {
    console.log(chalk.red.bold('🚨 Issues:'));
    analysis.issues.forEach(issue => {
      console.log(`   • ${issue}`);
    });
    console.log();
  }
  
  // Recommendations
  if (analysis.recommendations.length > 0) {
    console.log(chalk.blue.bold('💡 Recommendations:'));
    analysis.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
    console.log();
  }
  
  // File-level coverage (if available)
  if (coverage.detailed && Object.keys(coverage.detailed).length > 0) {
    console.log(chalk.yellow.bold('📁 File Coverage:'));
    
    const files = Object.entries(coverage.detailed)
      .map(([file, data]) => ({
        file: file.replace(process.cwd(), '.'),
        lines: data.lines?.pct || 0,
        functions: data.functions?.pct || 0,
        branches: data.branches?.pct || 0,
        statements: data.statements?.pct || 0
      }))
      .sort((a, b) => a.lines - b.lines) // Sort by coverage (lowest first)
      .slice(0, 10); // Show top 10 files with lowest coverage
    
    files.forEach(file => {
      console.log(`   ${file.file}`);
      console.log(`     Lines: ${getCoverageColor(file.lines)}${file.lines}%`, 
                  `Functions: ${getCoverageColor(file.functions)}${file.functions}%`,
                  `Branches: ${getCoverageColor(file.branches)}${file.branches}%`);
    });
    console.log();
  }
  
  // Save report if requested
  if (outputPath) {
    const reportData = {
      timestamp: this.getDeterministicDate().toISOString(),
      analysis,
      coverage: coverage.summary,
      success: analysisResult.success
    };
    
    if (format === 'json') {
      fs.writeFile(outputPath, JSON.stringify(reportData, null, 2))
        .then(() => console.log(chalk.green(`📁 Report saved to: ${outputPath}`)))
        .catch(error => console.error(chalk.red(`❌ Failed to save report: ${error.message}`)));
    }
  }
}

/**
 * Get color for coverage percentage
 * @param {number} percentage - Coverage percentage
 * @returns {Function} Chalk color function
 */
function getCoverageColor(percentage) {
  if (percentage >= 90) return chalk.green;
  if (percentage >= 80) return chalk.yellow;
  if (percentage >= 60) return chalk.orange;
  return chalk.red;
}

/**
 * Get color for quality grade
 * @param {string} grade - Quality grade
 * @returns {Function} Chalk color function
 */
function getGradeColor(grade) {
  switch (grade) {
    case 'A': return chalk.green.bold;
    case 'B': return chalk.green;
    case 'C': return chalk.yellow;
    case 'D': return chalk.orange;
    case 'F': return chalk.red.bold;
    default: return chalk.gray;
  }
}

/**
 * Get color for quality level
 * @param {string} level - Quality level
 * @returns {Function} Chalk color function
 */
function getQualityLevelColor(level) {
  switch (level) {
    case 'EXCELLENT': return chalk.green.bold;
    case 'GOOD': return chalk.green;
    case 'FAIR': return chalk.yellow;
    case 'POOR': return chalk.orange;
    case 'CRITICAL': return chalk.red.bold;
    default: return chalk.gray;
  }
}

/**
 * Main coverage analysis function
 * @param {Object} options - Analysis options
 */
async function analyzeCoverage(options = {}) {
  try {
    // Run coverage analysis
    const result = await runCoverageAnalysis(options);
    
    // Generate report
    generateCoverageReport(result, options);
    
    // Check quality gates
    if (result.coverage) {
      const analysis = analyzeCoverageQuality(result.coverage, options.threshold);
      
      if (analysis.grade === 'F' || analysis.overallScore < (options.minimumScore || 60)) {
        console.log(chalk.red.bold(`❌ Coverage quality gate failed: Grade ${analysis.grade} (${analysis.overallScore}%)`));
        process.exit(1);
      } else {
        console.log(chalk.green.bold(`✅ Coverage quality gate passed: Grade ${analysis.grade} (${analysis.overallScore}%)`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Coverage analysis failed:'), error.message);
    process.exit(1);
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      options.outputPath = args[i + 1];
      i++;
    } else if (arg === '--test-command' || arg === '-t') {
      options.testCommand = args[i + 1];
      i++;
    } else if (arg === '--threshold-lines') {
      options.threshold = { ...options.threshold, lines: parseInt(args[i + 1], 10) };
      i++;
    } else if (arg === '--threshold-functions') {
      options.threshold = { ...options.threshold, functions: parseInt(args[i + 1], 10) };
      i++;
    } else if (arg === '--threshold-branches') {
      options.threshold = { ...options.threshold, branches: parseInt(args[i + 1], 10) };
      i++;
    } else if (arg === '--threshold-statements') {
      options.threshold = { ...options.threshold, statements: parseInt(args[i + 1], 10) };
      i++;
    } else if (arg === '--minimum-score') {
      options.minimumScore = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--format') {
      options.format = args[i + 1];
      i++;
    }
  }
  
  analyzeCoverage(options);
}

export { analyzeCoverage, runCoverageAnalysis, analyzeCoverageQuality };