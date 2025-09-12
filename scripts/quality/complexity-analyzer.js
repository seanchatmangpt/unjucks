#!/usr/bin/env node

/**
 * Cyclomatic Complexity and Code Quality Analyzer
 * Analyzes JavaScript files for complexity metrics and quality indicators
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

/**
 * Calculate cyclomatic complexity of JavaScript code
 * @param {string} content - JavaScript source code
 * @returns {Object} Complexity metrics
 */
function calculateComplexity(content) {
  // Remove comments and strings to avoid false positives
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
    .replace(/\/\/.*$/gm, '') // Line comments
    .replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, ''); // Strings

  // Count complexity-increasing constructs
  const patterns = {
    ifStatements: /\bif\s*\(/g,
    elseIf: /\belse\s+if\s*\(/g,
    whileLoops: /\bwhile\s*\(/g,
    forLoops: /\bfor\s*\(/g,
    forInLoops: /\bfor\s+\w+\s+in\s+/g,
    forOfLoops: /\bfor\s+\w+\s+of\s+/g,
    switchCases: /\bcase\s+/g,
    catchBlocks: /\bcatch\s*\(/g,
    ternaryOperators: /\?[^:]*:/g,
    logicalAnd: /&&/g,
    logicalOr: /\|\|/g,
    nullishCoalescing: /\?\?/g,
    optionalChaining: /\?\./g,
    tryBlocks: /\btry\s*\{/g,
    asyncFunctions: /\basync\s+function/g,
    generators: /\bfunction\s*\*/g,
  };

  const counts = {};
  let totalComplexity = 1; // Base complexity

  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = cleanContent.match(pattern) || [];
    counts[key] = matches.length;
    
    // Weight different constructs
    switch (key) {
      case 'ifStatements':
      case 'elseIf':
      case 'whileLoops':
      case 'forLoops':
      case 'forInLoops':
      case 'forOfLoops':
      case 'switchCases':
      case 'catchBlocks':
        totalComplexity += matches.length;
        break;
      case 'ternaryOperators':
      case 'logicalAnd':
      case 'logicalOr':
        totalComplexity += matches.length * 0.5; // Half weight
        break;
      case 'nullishCoalescing':
      case 'optionalChaining':
        totalComplexity += matches.length * 0.3; // Lower weight
        break;
      case 'tryBlocks':
      case 'asyncFunctions':
      case 'generators':
        totalComplexity += matches.length * 0.8; // Moderate weight
        break;
    }
  }

  return {
    complexity: Math.round(totalComplexity),
    details: counts,
    riskLevel: getRiskLevel(totalComplexity)
  };
}

/**
 * Calculate maintainability metrics
 * @param {string} content - JavaScript source code
 * @returns {Object} Maintainability metrics
 */
function calculateMaintainability(content) {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim()).length;
  const commentLines = lines.filter(line => 
    line.trim().startsWith('//') || 
    line.trim().startsWith('*') ||
    line.trim().startsWith('/*')
  ).length;

  // Count functions
  const functionMatches = content.match(/\b(?:function|=>\s*{|=>\s*\w)/g) || [];
  const functionCount = functionMatches.length;

  // Count classes
  const classMatches = content.match(/\bclass\s+\w+/g) || [];
  const classCount = classMatches.length;

  // Calculate average line length
  const totalCharacters = lines.reduce((sum, line) => sum + line.length, 0);
  const avgLineLength = nonEmptyLines > 0 ? totalCharacters / nonEmptyLines : 0;

  // Calculate comment ratio
  const commentRatio = nonEmptyLines > 0 ? commentLines / nonEmptyLines : 0;

  return {
    linesOfCode: nonEmptyLines,
    commentLines,
    commentRatio: Math.round(commentRatio * 100),
    functionCount,
    classCount,
    averageLineLength: Math.round(avgLineLength),
    maintainabilityIndex: calculateMaintainabilityIndex(nonEmptyLines, functionCount, commentRatio, avgLineLength)
  };
}

/**
 * Calculate maintainability index (simplified version)
 * @param {number} loc - Lines of code
 * @param {number} functionCount - Number of functions
 * @param {number} commentRatio - Comment ratio
 * @param {number} avgLineLength - Average line length
 * @returns {number} Maintainability index (0-100)
 */
function calculateMaintainabilityIndex(loc, functionCount, commentRatio, avgLineLength) {
  // Simplified maintainability index calculation
  let index = 100;
  
  // Penalize for too many lines
  if (loc > 500) index -= (loc - 500) * 0.1;
  if (loc > 1000) index -= (loc - 1000) * 0.2;
  
  // Penalize for too many functions in one file
  if (functionCount > 20) index -= (functionCount - 20) * 2;
  
  // Bonus for good commenting
  if (commentRatio > 0.1) index += commentRatio * 50;
  
  // Penalize for very long lines
  if (avgLineLength > 120) index -= (avgLineLength - 120) * 0.5;
  
  return Math.max(0, Math.min(100, Math.round(index)));
}

/**
 * Get risk level based on complexity
 * @param {number} complexity - Cyclomatic complexity
 * @returns {string} Risk level
 */
function getRiskLevel(complexity) {
  if (complexity <= 5) return 'LOW';
  if (complexity <= 10) return 'MODERATE';
  if (complexity <= 15) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Get risk color for display
 * @param {string} riskLevel - Risk level
 * @returns {Function} Chalk color function
 */
function getRiskColor(riskLevel) {
  switch (riskLevel) {
    case 'LOW': return chalk.green;
    case 'MODERATE': return chalk.yellow;
    case 'HIGH': return chalk.orange;
    case 'CRITICAL': return chalk.red;
    default: return chalk.gray;
  }
}

/**
 * Analyze a single file
 * @param {string} filePath - Path to the file
 * @returns {Object} Analysis results
 */
async function analyzeFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const complexity = calculateComplexity(content);
    const maintainability = calculateMaintainability(content);
    
    return {
      file: filePath,
      complexity,
      maintainability,
      size: content.length,
      issues: identifyIssues(complexity, maintainability)
    };
  } catch (error) {
    return {
      file: filePath,
      error: error.message
    };
  }
}

/**
 * Identify code quality issues
 * @param {Object} complexity - Complexity metrics
 * @param {Object} maintainability - Maintainability metrics
 * @returns {Array} Array of issues
 */
function identifyIssues(complexity, maintainability) {
  const issues = [];
  
  if (complexity.complexity > 15) {
    issues.push({
      type: 'COMPLEXITY',
      severity: 'HIGH',
      message: `Cyclomatic complexity (${complexity.complexity}) exceeds threshold (15)`
    });
  }
  
  if (maintainability.linesOfCode > 500) {
    issues.push({
      type: 'SIZE',
      severity: 'MODERATE',
      message: `File too large (${maintainability.linesOfCode} lines). Consider breaking into smaller modules.`
    });
  }
  
  if (maintainability.commentRatio < 5) {
    issues.push({
      type: 'DOCUMENTATION',
      severity: 'LOW',
      message: `Low comment ratio (${maintainability.commentRatio}%). Consider adding more documentation.`
    });
  }
  
  if (maintainability.functionCount > 20) {
    issues.push({
      type: 'ORGANIZATION',
      severity: 'MODERATE',
      message: `Too many functions (${maintainability.functionCount}) in single file. Consider refactoring.`
    });
  }
  
  if (maintainability.averageLineLength > 120) {
    issues.push({
      type: 'READABILITY',
      severity: 'LOW',
      message: `Long average line length (${maintainability.averageLineLength} chars). Consider formatting improvements.`
    });
  }
  
  return issues;
}

/**
 * Generate quality report
 * @param {Array} results - Analysis results
 * @returns {Object} Quality report
 */
function generateReport(results) {
  const validResults = results.filter(r => !r.error);
  const errorResults = results.filter(r => r.error);
  
  if (validResults.length === 0) {
    return {
      summary: { filesAnalyzed: 0, totalIssues: 0 },
      details: [],
      errors: errorResults
    };
  }
  
  const totalComplexity = validResults.reduce((sum, r) => sum + r.complexity.complexity, 0);
  const avgComplexity = totalComplexity / validResults.length;
  
  const totalMaintainability = validResults.reduce((sum, r) => sum + r.maintainability.maintainabilityIndex, 0);
  const avgMaintainability = totalMaintainability / validResults.length;
  
  const totalIssues = validResults.reduce((sum, r) => sum + r.issues.length, 0);
  
  const riskDistribution = validResults.reduce((dist, r) => {
    dist[r.complexity.riskLevel] = (dist[r.complexity.riskLevel] || 0) + 1;
    return dist;
  }, {});
  
  return {
    summary: {
      filesAnalyzed: validResults.length,
      averageComplexity: Math.round(avgComplexity * 100) / 100,
      averageMaintainability: Math.round(avgMaintainability * 100) / 100,
      totalIssues,
      riskDistribution,
      qualityGrade: getQualityGrade(avgComplexity, avgMaintainability, totalIssues / validResults.length)
    },
    details: validResults,
    errors: errorResults
  };
}

/**
 * Calculate overall quality grade
 * @param {number} avgComplexity - Average complexity
 * @param {number} avgMaintainability - Average maintainability
 * @param {number} avgIssuesPerFile - Average issues per file
 * @returns {string} Quality grade
 */
function getQualityGrade(avgComplexity, avgMaintainability, avgIssuesPerFile) {
  let score = 0;
  
  // Complexity scoring (lower is better)
  if (avgComplexity <= 5) score += 30;
  else if (avgComplexity <= 10) score += 20;
  else if (avgComplexity <= 15) score += 10;
  
  // Maintainability scoring (higher is better)
  if (avgMaintainability >= 80) score += 30;
  else if (avgMaintainability >= 60) score += 20;
  else if (avgMaintainability >= 40) score += 10;
  
  // Issues scoring (lower is better)
  if (avgIssuesPerFile <= 1) score += 25;
  else if (avgIssuesPerFile <= 2) score += 15;
  else if (avgIssuesPerFile <= 3) score += 10;
  else if (avgIssuesPerFile <= 5) score += 5;
  
  // Additional scoring for very good metrics
  if (avgComplexity <= 3 && avgMaintainability >= 90) score += 15;
  
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Display results in console
 * @param {Object} report - Quality report
 */
function displayResults(report) {
  console.log(chalk.blue.bold('\n🔍 Code Quality Analysis Report\n'));
  
  // Summary
  console.log(chalk.yellow.bold('📊 Summary:'));
  console.log(`   Files Analyzed: ${report.summary.filesAnalyzed}`);
  console.log(`   Average Complexity: ${report.summary.averageComplexity}`);
  console.log(`   Average Maintainability: ${report.summary.averageMaintainability}%`);
  console.log(`   Total Issues: ${report.summary.totalIssues}`);
  console.log(`   Quality Grade: ${getGradeColor(report.summary.qualityGrade)(report.summary.qualityGrade)}\n`);
  
  // Risk distribution
  if (report.summary.riskDistribution) {
    console.log(chalk.yellow.bold('⚠️  Risk Distribution:'));
    Object.entries(report.summary.riskDistribution).forEach(([risk, count]) => {
      console.log(`   ${getRiskColor(risk)(risk)}: ${count} files`);
    });
    console.log();
  }
  
  // Top issues
  const topIssues = report.details
    .filter(r => r.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 10);
    
  if (topIssues.length > 0) {
    console.log(chalk.yellow.bold('🚨 Files with Most Issues:'));
    topIssues.forEach(file => {
      const riskColor = getRiskColor(file.complexity.riskLevel);
      console.log(`   ${riskColor(file.file.replace(process.cwd(), '.'))} (${file.issues.length} issues, complexity: ${file.complexity.complexity})`);
    });
    console.log();
  }
  
  // Errors
  if (report.errors.length > 0) {
    console.log(chalk.red.bold('❌ Analysis Errors:'));
    report.errors.forEach(error => {
      console.log(`   ${error.file}: ${error.error}`);
    });
    console.log();
  }
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
 * Save report to file
 * @param {Object} report - Quality report
 * @param {string} outputPath - Output file path
 */
async function saveReport(report, outputPath) {
  const reportData = {
    timestamp: this.getDeterministicDate().toISOString(),
    ...report
  };
  
  await fs.writeFile(outputPath, JSON.stringify(reportData, null, 2));
  console.log(chalk.green(`📁 Report saved to: ${outputPath}`));
}

/**
 * Main analysis function
 * @param {Object} options - Analysis options
 */
async function analyzeCodeQuality(options = {}) {
  const {
    pattern = 'src/**/*.js',
    exclude = ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'tests/**', '**/*.test.js', '**/*.spec.js'],
    output = null,
    threshold = 15
  } = options;
  
  console.log(chalk.blue('🔍 Starting code quality analysis...\n'));
  
  try {
    // Find files to analyze
    const files = await glob(pattern, {
      ignore: exclude,
      absolute: true
    });
    
    if (files.length === 0) {
      console.log(chalk.yellow('⚠️  No files found matching pattern'));
      return;
    }
    
    console.log(chalk.gray(`Found ${files.length} files to analyze\n`));
    
    // Analyze files
    const results = await Promise.all(files.map(analyzeFile));
    
    // Generate report
    const report = generateReport(results);
    
    // Display results
    displayResults(report);
    
    // Save report if requested
    if (output) {
      await saveReport(report, output);
    }
    
    // Check quality gates
    const failed = report.details.some(r => r.complexity.complexity > threshold);
    if (failed) {
      console.log(chalk.red.bold(`❌ Quality gate failed: Files exceed complexity threshold (${threshold})`));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('✅ Quality gate passed'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Analysis failed:'), error.message);
    process.exit(1);
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse simple CLI args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      options.output = args[i + 1];
      i++;
    } else if (arg === '--pattern' || arg === '-p') {
      options.pattern = args[i + 1];
      i++;
    } else if (arg === '--threshold' || arg === '-t') {
      options.threshold = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  analyzeCodeQuality(options);
}

export { analyzeCodeQuality, calculateComplexity, calculateMaintainability };