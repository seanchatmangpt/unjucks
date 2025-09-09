#!/usr/bin/env node

/**
 * Quality Metrics Dashboard Generator
 * Creates comprehensive quality reports and metrics visualization
 */

import fs from 'fs/promises';
import path from 'path';
import { analyzeCodeQuality, calculateComplexity, calculateMaintainability } from './complexity-analyzer.js';
import chalk from 'chalk';

/**
 * Generate HTML quality dashboard
 * @param {Object} qualityReport - Quality analysis report
 * @param {Object} options - Dashboard options
 * @returns {string} HTML dashboard content
 */
function generateHTMLDashboard(qualityReport, options = {}) {
  const { title = 'Code Quality Dashboard', timestamp = new Date().toISOString() } = options;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #2c3e50; font-size: 2.5em; margin-bottom: 10px; }
        .header .timestamp { color: #7f8c8d; font-size: 0.9em; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .metric-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #7f8c8d; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .metric-change { font-size: 0.8em; margin-top: 5px; }
        
        .grade-A { color: #27ae60; }
        .grade-B { color: #3498db; }
        .grade-C { color: #f39c12; }
        .grade-D { color: #e67e22; }
        .grade-F { color: #e74c3c; }
        
        .risk-low { color: #27ae60; }
        .risk-moderate { color: #f39c12; }
        .risk-high { color: #e67e22; }
        .risk-critical { color: #e74c3c; }
        
        .section { background: white; margin-bottom: 30px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: #34495e; color: white; padding: 20px; font-size: 1.2em; font-weight: bold; }
        .section-content { padding: 25px; }
        
        .risk-chart { display: flex; gap: 10px; margin-bottom: 20px; }
        .risk-bar { height: 30px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; min-width: 60px; }
        .risk-bar.low { background: #27ae60; }
        .risk-bar.moderate { background: #f39c12; }
        .risk-bar.high { background: #e67e22; }
        .risk-bar.critical { background: #e74c3c; }
        
        .files-list { max-height: 400px; overflow-y: auto; border: 1px solid #ecf0f1; border-radius: 5px; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #ecf0f1; }
        .file-item:last-child { border-bottom: none; }
        .file-name { font-family: 'Monaco', 'Menlo', monospace; font-size: 0.9em; }
        .file-metrics { display: flex; gap: 15px; font-size: 0.8em; }
        .file-complexity { padding: 2px 8px; border-radius: 3px; color: white; font-weight: bold; }
        
        .issues-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .issue-card { border-left: 4px solid #e74c3c; padding: 15px; background: #fdf2f2; border-radius: 0 5px 5px 0; }
        .issue-card.moderate { border-color: #f39c12; background: #fef9e7; }
        .issue-card.low { border-color: #3498db; background: #ebf3fd; }
        .issue-title { font-weight: bold; margin-bottom: 5px; }
        .issue-description { font-size: 0.9em; color: #555; }
        
        .progress-bar { width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #27ae60 100%); transition: width 0.3s ease; }
        
        .legend { display: flex; gap: 20px; justify-content: center; margin-top: 20px; font-size: 0.9em; }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-color { width: 15px; height: 15px; border-radius: 3px; }
        
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .metrics-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 2em; }
            .file-metrics { flex-direction: column; gap: 5px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${title}</h1>
            <div class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</div>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value grade-${qualityReport.summary.qualityGrade}">${qualityReport.summary.qualityGrade}</div>
                <div class="metric-label">Quality Grade</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${qualityReport.summary.filesAnalyzed}</div>
                <div class="metric-label">Files Analyzed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${qualityReport.summary.averageComplexity}</div>
                <div class="metric-label">Avg Complexity</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${qualityReport.summary.averageMaintainability}%</div>
                <div class="metric-label">Maintainability</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${qualityReport.summary.totalIssues}</div>
                <div class="metric-label">Total Issues</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">⚠️ Risk Distribution</div>
            <div class="section-content">
                <div class="risk-chart">
                    ${Object.entries(qualityReport.summary.riskDistribution || {}).map(([risk, count]) => 
                        `<div class="risk-bar ${risk.toLowerCase()}" style="flex: ${count}">
                            ${risk} (${count})
                        </div>`
                    ).join('')}
                </div>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-color risk-low"></div>
                        <span>Low Risk (≤5)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color risk-moderate"></div>
                        <span>Moderate (6-10)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color risk-high"></div>
                        <span>High (11-15)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color risk-critical"></div>
                        <span>Critical (>15)</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">📁 File Analysis</div>
            <div class="section-content">
                <div class="files-list">
                    ${qualityReport.details.slice(0, 50).map(file => `
                        <div class="file-item">
                            <div class="file-name">${file.file.replace(process.cwd(), '.')}</div>
                            <div class="file-metrics">
                                <div class="file-complexity ${file.complexity.riskLevel.toLowerCase()}">${file.complexity.complexity}</div>
                                <div>📊 ${file.maintainability.maintainabilityIndex}%</div>
                                <div>📄 ${file.maintainability.linesOfCode} LOC</div>
                                <div>🚨 ${file.issues.length} issues</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${qualityReport.details.length > 50 ? `<p style="text-align: center; margin-top: 15px; color: #7f8c8d;">Showing top 50 of ${qualityReport.details.length} files</p>` : ''}
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">🚨 Top Issues</div>
            <div class="section-content">
                <div class="issues-grid">
                    ${qualityReport.details
                        .filter(file => file.issues.length > 0)
                        .sort((a, b) => b.issues.length - a.issues.length)
                        .slice(0, 12)
                        .map(file => `
                            <div class="issue-card">
                                <div class="issue-title">${path.basename(file.file)}</div>
                                <div class="issue-description">
                                    ${file.issues.slice(0, 3).map(issue => 
                                        `<div>• ${issue.message}</div>`
                                    ).join('')}
                                    ${file.issues.length > 3 ? `<div>... and ${file.issues.length - 3} more issues</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">📈 Quality Trends</div>
            <div class="section-content">
                <p style="text-align: center; color: #7f8c8d; padding: 40px;">
                    Historical trend data will be available after multiple quality reports.<br>
                    Run quality analysis regularly to track improvements over time.
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

/**
 * Generate markdown quality report
 * @param {Object} qualityReport - Quality analysis report
 * @returns {string} Markdown report content
 */
function generateMarkdownReport(qualityReport) {
  const { summary, details } = qualityReport;
  
  const markdown = `# 📊 Code Quality Report

**Generated:** ${new Date().toLocaleString()}

## 🎯 Summary

| Metric | Value |
|--------|-------|
| 📁 Files Analyzed | ${summary.filesAnalyzed} |
| 🎯 Quality Grade | ${summary.qualityGrade} |
| 🧠 Average Complexity | ${summary.averageComplexity} |
| 🔧 Average Maintainability | ${summary.averageMaintainability}% |
| 🚨 Total Issues | ${summary.totalIssues} |

## ⚠️ Risk Distribution

${Object.entries(summary.riskDistribution || {}).map(([risk, count]) => 
  `- **${risk}**: ${count} files`
).join('\n')}

## 🚨 Files with Most Issues

${details
  .filter(file => file.issues.length > 0)
  .sort((a, b) => b.issues.length - a.issues.length)
  .slice(0, 10)
  .map((file, index) => 
    `${index + 1}. **${file.file.replace(process.cwd(), '.')}** (${file.issues.length} issues, complexity: ${file.complexity.complexity})`
  ).join('\n')}

## 📈 Detailed Analysis

### Complexity Distribution
- **Low Risk (≤5)**: ${summary.riskDistribution?.LOW || 0} files
- **Moderate Risk (6-10)**: ${summary.riskDistribution?.MODERATE || 0} files  
- **High Risk (11-15)**: ${summary.riskDistribution?.HIGH || 0} files
- **Critical Risk (>15)**: ${summary.riskDistribution?.CRITICAL || 0} files

### Quality Recommendations

${summary.qualityGrade === 'F' ? '🔴 **Critical**: Immediate attention required' : ''}
${summary.qualityGrade === 'D' ? '🟠 **Poor**: Significant improvements needed' : ''}
${summary.qualityGrade === 'C' ? '🟡 **Fair**: Some improvements recommended' : ''}
${summary.qualityGrade === 'B' ? '🟢 **Good**: Minor optimizations possible' : ''}
${summary.qualityGrade === 'A' ? '🟢 **Excellent**: Maintain current standards' : ''}

### Action Items

${summary.averageComplexity > 10 ? '- 🧠 **Reduce complexity**: Focus on refactoring complex functions' : ''}
${summary.averageMaintainability < 60 ? '- 🔧 **Improve maintainability**: Add documentation and break down large files' : ''}
${summary.totalIssues > summary.filesAnalyzed * 2 ? '- 🚨 **Address issues**: High issue-to-file ratio detected' : ''}
${(summary.riskDistribution?.CRITICAL || 0) > 0 ? '- 🔴 **Critical risk**: Address high-complexity files immediately' : ''}

---

*Report generated by Unjucks Quality Analyzer*`;

  return markdown;
}

/**
 * Generate quality metrics over time
 * @param {Object} currentReport - Current quality report
 * @param {string} historyPath - Path to historical data
 * @returns {Object} Trend analysis
 */
async function generateTrendAnalysis(currentReport, historyPath) {
  try {
    // Read historical data
    const historyExists = await fs.access(historyPath).then(() => true).catch(() => false);
    let history = [];
    
    if (historyExists) {
      const historyContent = await fs.readFile(historyPath, 'utf8');
      history = JSON.parse(historyContent);
    }
    
    // Add current report to history
    const currentEntry = {
      timestamp: new Date().toISOString(),
      summary: currentReport.summary
    };
    
    history.push(currentEntry);
    
    // Keep only last 30 entries
    if (history.length > 30) {
      history = history.slice(-30);
    }
    
    // Save updated history
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    
    // Calculate trends
    if (history.length < 2) {
      return { trend: 'insufficient-data', history };
    }
    
    const previous = history[history.length - 2];
    const current = history[history.length - 1];
    
    const trends = {
      qualityGrade: {
        previous: previous.summary.qualityGrade,
        current: current.summary.qualityGrade,
        direction: getGradeTrend(previous.summary.qualityGrade, current.summary.qualityGrade)
      },
      complexity: {
        previous: previous.summary.averageComplexity,
        current: current.summary.averageComplexity,
        change: current.summary.averageComplexity - previous.summary.averageComplexity,
        direction: current.summary.averageComplexity > previous.summary.averageComplexity ? 'worse' : 'better'
      },
      maintainability: {
        previous: previous.summary.averageMaintainability,
        current: current.summary.averageMaintainability,
        change: current.summary.averageMaintainability - previous.summary.averageMaintainability,
        direction: current.summary.averageMaintainability > previous.summary.averageMaintainability ? 'better' : 'worse'
      },
      issues: {
        previous: previous.summary.totalIssues,
        current: current.summary.totalIssues,
        change: current.summary.totalIssues - previous.summary.totalIssues,
        direction: current.summary.totalIssues > previous.summary.totalIssues ? 'worse' : 'better'
      }
    };
    
    return { trends, history };
    
  } catch (error) {
    console.warn('⚠️  Could not generate trend analysis:', error.message);
    return { trend: 'error', error: error.message };
  }
}

/**
 * Get grade trend direction
 * @param {string} previous - Previous grade
 * @param {string} current - Current grade
 * @returns {string} Trend direction
 */
function getGradeTrend(previous, current) {
  const grades = { F: 0, D: 1, C: 2, B: 3, A: 4 };
  const prevScore = grades[previous] || 0;
  const currScore = grades[current] || 0;
  
  if (currScore > prevScore) return 'better';
  if (currScore < prevScore) return 'worse';
  return 'stable';
}

/**
 * Main dashboard generation function
 * @param {Object} options - Dashboard options
 */
async function generateQualityDashboard(options = {}) {
  const {
    outputDir = 'quality-reports',
    formats = ['html', 'markdown'],
    pattern = 'src/**/*.js',
    threshold = 15
  } = options;
  
  console.log(chalk.blue('📊 Generating quality dashboard...\n'));
  
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Run quality analysis
    console.log(chalk.gray('🔍 Running quality analysis...'));
    const qualityReport = await new Promise((resolve, reject) => {
      // Import and run the analyzer
      import('./complexity-analyzer.js').then(async ({ analyzeCodeQuality }) => {
        try {
          // Capture the analysis results
          const originalExit = process.exit;
          let analysisComplete = false;
          
          process.exit = (code) => {
            if (!analysisComplete) {
              // Don't actually exit, we want to continue
              analysisComplete = true;
              return;
            }
            originalExit(code);
          };
          
          // Run analysis with custom options to get report data
          const { glob } = await import('glob');
          const files = await glob(pattern, {
            ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'tests/**', '**/*.test.js', '**/*.spec.js'],
            absolute: true
          });
          
          const { calculateComplexity, calculateMaintainability } = await import('./complexity-analyzer.js');
          
          const results = await Promise.all(files.map(async (filePath) => {
            try {
              const content = await fs.readFile(filePath, 'utf8');
              const complexity = calculateComplexity(content);
              const maintainability = calculateMaintainability(content);
              
              const issues = [];
              if (complexity.complexity > threshold) {
                issues.push({
                  type: 'COMPLEXITY',
                  severity: 'HIGH',
                  message: `Cyclomatic complexity (${complexity.complexity}) exceeds threshold (${threshold})`
                });
              }
              
              return {
                file: filePath,
                complexity,
                maintainability,
                size: content.length,
                issues
              };
            } catch (error) {
              return { file: filePath, error: error.message };
            }
          }));
          
          // Generate report
          const validResults = results.filter(r => !r.error);
          if (validResults.length === 0) {
            resolve({
              summary: { filesAnalyzed: 0, totalIssues: 0, qualityGrade: 'F' },
              details: [],
              errors: results.filter(r => r.error)
            });
            return;
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
          
          // Calculate quality grade
          let score = 0;
          if (avgComplexity <= 5) score += 30;
          else if (avgComplexity <= 10) score += 20;
          else if (avgComplexity <= 15) score += 10;
          
          if (avgMaintainability >= 80) score += 30;
          else if (avgMaintainability >= 60) score += 20;
          else if (avgMaintainability >= 40) score += 10;
          
          const avgIssuesPerFile = totalIssues / validResults.length;
          if (avgIssuesPerFile <= 1) score += 25;
          else if (avgIssuesPerFile <= 2) score += 15;
          else if (avgIssuesPerFile <= 3) score += 10;
          else if (avgIssuesPerFile <= 5) score += 5;
          
          if (avgComplexity <= 3 && avgMaintainability >= 90) score += 15;
          
          let qualityGrade = 'F';
          if (score >= 85) qualityGrade = 'A';
          else if (score >= 70) qualityGrade = 'B';
          else if (score >= 55) qualityGrade = 'C';
          else if (score >= 40) qualityGrade = 'D';
          
          const report = {
            summary: {
              filesAnalyzed: validResults.length,
              averageComplexity: Math.round(avgComplexity * 100) / 100,
              averageMaintainability: Math.round(avgMaintainability * 100) / 100,
              totalIssues,
              riskDistribution,
              qualityGrade
            },
            details: validResults,
            errors: results.filter(r => r.error)
          };
          
          process.exit = originalExit;
          resolve(report);
        } catch (error) {
          process.exit = originalExit;
          reject(error);
        }
      }).catch(reject);
    });
    
    console.log(chalk.green('✅ Quality analysis completed\n'));
    
    // Generate trend analysis
    const historyPath = path.join(outputDir, 'quality-history.json');
    const trendAnalysis = await generateTrendAnalysis(qualityReport, historyPath);
    
    // Generate reports in requested formats
    const timestamp = new Date().toISOString();
    const reports = [];
    
    if (formats.includes('html')) {
      console.log(chalk.gray('🌐 Generating HTML dashboard...'));
      const htmlContent = generateHTMLDashboard(qualityReport, {
        title: 'Unjucks Code Quality Dashboard',
        timestamp
      });
      const htmlPath = path.join(outputDir, `quality-dashboard-${timestamp.split('T')[0]}.html`);
      await fs.writeFile(htmlPath, htmlContent);
      reports.push({ format: 'HTML', path: htmlPath });
      console.log(chalk.green(`✅ HTML dashboard: ${htmlPath}`));
    }
    
    if (formats.includes('markdown')) {
      console.log(chalk.gray('📝 Generating Markdown report...'));
      const markdownContent = generateMarkdownReport(qualityReport);
      const markdownPath = path.join(outputDir, `quality-report-${timestamp.split('T')[0]}.md`);
      await fs.writeFile(markdownPath, markdownContent);
      reports.push({ format: 'Markdown', path: markdownPath });
      console.log(chalk.green(`✅ Markdown report: ${markdownPath}`));
    }
    
    // Generate JSON report for API consumption
    const jsonPath = path.join(outputDir, `quality-data-${timestamp.split('T')[0]}.json`);
    const fullReport = {
      timestamp,
      qualityReport,
      trendAnalysis,
      metadata: {
        threshold,
        pattern,
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    await fs.writeFile(jsonPath, JSON.stringify(fullReport, null, 2));
    reports.push({ format: 'JSON', path: jsonPath });
    
    // Display summary
    console.log(chalk.blue.bold('\n📊 Quality Dashboard Generated\n'));
    console.log(chalk.yellow('📋 Summary:'));
    console.log(`   Quality Grade: ${getGradeColor(qualityReport.summary.qualityGrade)(qualityReport.summary.qualityGrade)}`);
    console.log(`   Files Analyzed: ${qualityReport.summary.filesAnalyzed}`);
    console.log(`   Average Complexity: ${qualityReport.summary.averageComplexity}`);
    console.log(`   Average Maintainability: ${qualityReport.summary.averageMaintainability}%`);
    console.log(`   Total Issues: ${qualityReport.summary.totalIssues}`);
    
    console.log(chalk.yellow('\n📁 Generated Reports:'));
    reports.forEach(report => {
      console.log(`   ${report.format}: ${report.path}`);
    });
    
    // Trend information
    if (trendAnalysis.trends) {
      console.log(chalk.yellow('\n📈 Trends:'));
      const { trends } = trendAnalysis;
      console.log(`   Quality Grade: ${trends.qualityGrade.previous} → ${trends.qualityGrade.current} (${trends.qualityGrade.direction})`);
      console.log(`   Complexity: ${trends.complexity.previous} → ${trends.complexity.current} (${trends.complexity.direction})`);
      console.log(`   Maintainability: ${trends.maintainability.previous}% → ${trends.maintainability.current}% (${trends.maintainability.direction})`);
    }
    
    console.log(chalk.green.bold('\n✅ Dashboard generation completed'));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Dashboard generation failed:'), error.message);
    process.exit(1);
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

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      options.outputDir = args[i + 1];
      i++;
    } else if (arg === '--format' || arg === '-f') {
      options.formats = args[i + 1].split(',');
      i++;
    } else if (arg === '--pattern' || arg === '-p') {
      options.pattern = args[i + 1];
      i++;
    } else if (arg === '--threshold' || arg === '-t') {
      options.threshold = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  generateQualityDashboard(options);
}

export { generateQualityDashboard, generateHTMLDashboard, generateMarkdownReport };