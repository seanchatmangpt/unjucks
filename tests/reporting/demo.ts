#!/usr/bin/env tsx

/**
 * Demo script to generate sample reports with real functionality
 */

import fs from 'fs-extra'
import path from 'path'
import { securityReporter } from './security'
import { benchmarkReporter } from './benchmarks'
import CoverageConfiguration from './coverage.config'

async function generateDemoReports() {
  console.log('🚀 Generating demo reports...')
  
  try {
    // Ensure report directories exist
    await fs.ensureDir('reports/security')
    await fs.ensureDir('reports/performance') 
    await fs.ensureDir('reports/coverage')

    // Initialize reporters
    await securityReporter.initialize()
    await benchmarkReporter.initialize()

    // Generate security report with sample source files
    console.log('🔒 Generating security report...')
    const sourceFiles = [
      'src/lib/generator.ts',
      'src/commands/Hello.ts', 
      'src/UserProfile.ts'
    ].filter(file => fs.existsSync(file))

    if (sourceFiles.length > 0) {
      const securityReport = await securityReporter.generateSecurityReport(sourceFiles)
      console.log(`   Security Grade: ${securityReport.summary.security_grade}`)
      console.log(`   Vulnerabilities: ${securityReport.summary.total}`)
    }

    // Generate performance report with mock data
    console.log('⚡ Generating performance report...')
    const mockBenchmarkResults = [
      {
        name: 'Template Generation Speed',
        samples: Array.from({ length: 100 }, () => Math.random() * 50 + 10),
        meta: { suite: 'core-generation' }
      },
      {
        name: 'File System Operations',
        samples: Array.from({ length: 100 }, () => Math.random() * 30 + 5),
        meta: { suite: 'filesystem' }
      },
      {
        name: 'CLI Command Processing',
        samples: Array.from({ length: 100 }, () => Math.random() * 100 + 20),
        meta: { suite: 'cli-commands' }
      },
      {
        name: 'Template Scanning',
        samples: Array.from({ length: 100 }, () => Math.random() * 25 + 8),
        meta: { suite: 'template-scanning' }
      },
      {
        name: 'Variable Injection',
        samples: Array.from({ length: 100 }, () => Math.random() * 15 + 3),
        meta: { suite: 'template-rendering' }
      }
    ]

    const performanceReport = await benchmarkReporter.generateReport(mockBenchmarkResults)
    console.log(`   Performance Grade: ${performanceReport.summary.overallGrade}`)
    console.log(`   Performance Score: ${performanceReport.summary.performanceScore}`)

    // Generate coverage analysis with mock data
    console.log('📊 Analyzing coverage data...')
    const mockCoverageData = {
      total: {
        statements: { pct: 85.5 },
        branches: { pct: 78.2 },
        functions: { pct: 92.1 },
        lines: { pct: 86.3 }
      },
      files: {
        'src/lib/generator.ts': {
          statements: { pct: 95.0 },
          branches: { pct: 88.0 },
          functions: { pct: 100.0 },
          lines: { pct: 96.0 }
        },
        'src/lib/template-scanner.ts': {
          statements: { pct: 82.0 },
          branches: { pct: 75.0 },
          functions: { pct: 90.0 },
          lines: { pct: 83.0 }
        }
      }
    }

    const coverageAnalysis = CoverageConfiguration.analyzeCoverageReport(mockCoverageData)
    console.log(`   Coverage Status: ${coverageAnalysis.status}`)
    console.log(`   Recommendations: ${coverageAnalysis.recommendations.length}`)

    // Generate master HTML dashboard
    await generateDashboard({
      securityReport: sourceFiles.length > 0 ? securityReport : null,
      performanceReport,
      coverageAnalysis
    })

    console.log('✅ Demo reports generated successfully!')
    console.log(`📊 View dashboard: ${path.resolve('reports/index.html')}`)

  } catch (error) {
    console.error('❌ Failed to generate demo reports:', error)
    throw error
  }
}

async function generateDashboard(reports: any) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks - Test Report Dashboard (Demo)</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 15px; text-align: center; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .demo-banner { background: #28a745; color: white; padding: 10px; text-align: center; margin-bottom: 20px; border-radius: 5px; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px; }
        .card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); transition: transform 0.2s ease; }
        .card:hover { transform: translateY(-2px); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card-title { font-size: 1.3em; font-weight: 600; margin: 0; }
        .grade { font-size: 2em; font-weight: bold; padding: 10px 20px; border-radius: 50px; }
        .grade-a { background: #d4edda; color: #155724; }
        .grade-b { background: #cce7ff; color: #004085; }
        .grade-c { background: #fff3cd; color: #856404; }
        .grade-d { background: #f8d7da; color: #721c24; }
        .grade-f { background: #f8d7da; color: #721c24; }
        .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .metric-value { font-size: 1.8em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #6c757d; font-size: 0.9em; margin-top: 5px; }
        .links { margin-top: 20px; }
        .link { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 5px; transition: background 0.2s; }
        .link:hover { background: #0056b3; }
        .feature-list { margin: 20px 0; }
        .feature { padding: 10px; margin: 5px 0; background: #f8f9fa; border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="demo-banner">
            🧪 DEMO MODE - Comprehensive Test Reporting System
        </div>
        
        <div class="header">
            <h1>🧪 Unjucks Test Report Dashboard</h1>
            <p>Comprehensive testing analysis and quality metrics</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="cards">
            ${reports.securityReport ? `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🔒 Security Analysis</h3>
                    <div class="grade grade-${reports.securityReport.summary.security_grade.toLowerCase()}">${reports.securityReport.summary.security_grade}</div>
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${reports.securityReport.summary.risk_score}</div>
                        <div class="metric-label">Risk Score</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${reports.securityReport.summary.total}</div>
                        <div class="metric-label">Total Issues</div>
                    </div>
                </div>
                <div class="links">
                    <a href="security/security-report.html" class="link">View Security Report</a>
                    <a href="security/security-report.json" class="link">JSON Report</a>
                </div>
            </div>` : `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🔒 Security Analysis</h3>
                    <div class="grade grade-a">A</div>
                </div>
                <p>Security scanning ready - add source files to enable analysis</p>
            </div>`}

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">⚡ Performance</h3>
                    <div class="grade grade-${reports.performanceReport.summary.overallGrade.toLowerCase()}">${reports.performanceReport.summary.overallGrade}</div>
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${reports.performanceReport.summary.performanceScore}</div>
                        <div class="metric-label">Performance Score</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${reports.performanceReport.summary.totalTests}</div>
                        <div class="metric-label">Benchmarks</div>
                    </div>
                </div>
                <div class="links">
                    <a href="performance/performance-report.html" class="link">View Performance Report</a>
                    <a href="performance/performance-data.csv" class="link">CSV Data</a>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📊 Code Coverage</h3>
                    <div class="grade grade-${reports.coverageAnalysis.status.charAt(0).toLowerCase()}">${reports.coverageAnalysis.status.charAt(0).toUpperCase()}</div>
                </div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${reports.coverageAnalysis.recommendations.length}</div>
                        <div class="metric-label">Recommendations</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${reports.coverageAnalysis.criticalFiles.length}</div>
                        <div class="metric-label">Critical Files</div>
                    </div>
                </div>
                <div class="links">
                    <a href="coverage/index.html" class="link">View Coverage Report</a>
                </div>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">✨ Reporting System Features</h3>
            <div class="feature-list">
                <div class="feature">🔒 <strong>Security Vulnerability Scanning</strong> - Pattern-based detection with CWE/CVSS scoring</div>
                <div class="feature">⚡ <strong>Performance Benchmarking</strong> - Comprehensive timing analysis with regression detection</div>
                <div class="feature">📊 <strong>Code Coverage Analysis</strong> - Detailed breakdown with component-specific thresholds</div>
                <div class="feature">🧪 <strong>Test Execution Metrics</strong> - Flaky test detection and trend analysis</div>
                <div class="feature">🌊 <strong>Multi-Format Output</strong> - HTML, JSON, XML, CSV, and SARIF reports</div>
                <div class="feature">🔄 <strong>CI/CD Integration</strong> - GitHub Actions, JUnit, and automated reporting</div>
                <div class="feature">📈 <strong>Historical Trending</strong> - Performance and quality trend analysis</div>
                <div class="feature">🎯 <strong>Actionable Recommendations</strong> - Specific guidance for improvement</div>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">🚀 Getting Started</h3>
            <div class="feature-list">
                <div class="feature">Run <code>npm run reports</code> to generate all reports</div>
                <div class="feature">Use <code>npm run reports:security</code> for security-only analysis</div>
                <div class="feature">Use <code>npm run reports:performance</code> for performance benchmarks</div>
                <div class="feature">Use <code>npm run reports:coverage</code> for coverage analysis</div>
                <div class="feature">Add <code>--cleanup</code> flag to remove old reports</div>
            </div>
        </div>
    </div>
</body>
</html>`

  await fs.writeFile('reports/index.html', html)
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDemoReports().catch(console.error)
}

export { generateDemoReports }