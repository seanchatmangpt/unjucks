import type { Reporter, UserConfig } from 'vitest/node'
import type { TestResult, TestReport, CoverageReport } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { performance } from 'perf_hooks'

interface TestMetrics {
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  duration: number
  coverage?: CoverageReport
  flaky: string[]
  slowTests: Array<{ name: string; duration: number }>
  memoryUsage: NodeJS.MemoryUsage
  trends: TestTrendData
}

interface TestTrendData {
  passRate: number
  avgDuration: number
  testCount: number
  timestamp: number
}

interface FlakyTestData {
  testName: string
  failures: number
  runs: number
  lastFailure: number
  pattern: 'intermittent' | 'environment' | 'timing' | 'race-condition'
}

export class ComprehensiveReporter implements Reporter {
  private startTime = 0
  private reports: Map<string, TestReport> = new Map()
  private flakyTests: Map<string, FlakyTestData> = new Map()
  private historicalData: TestTrendData[] = []
  private reportDir = 'reports'
  private securityIssues: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; file?: string }> = []

  async onInit(config: UserConfig) {
    await fs.ensureDir(this.reportDir)
    this.startTime = performance.now()
    
    // Load historical data for trend analysis
    await this.loadHistoricalData()
    
    console.log('📊 Comprehensive Test Reporter Initialized')
    console.log(`   Report Directory: ${path.resolve(this.reportDir)}`)
  }

  onTestFinished(test: TestResult) {
    const suite = test.meta?.suite || 'unknown'
    
    // Track test execution metrics
    const duration = test.duration || 0
    
    // Detect slow tests (>5 seconds)
    if (duration > 5000) {
      console.warn(`⚠️  Slow test detected: ${test.name} (${duration}ms)`)
    }

    // Flaky test detection based on retry patterns
    if (test.retry && test.retry > 0) {
      this.trackFlakyTest(test.name, test.retry)
    }

    // Security vulnerability detection in test names/errors
    this.scanForSecurityIssues(test)
  }

  async onFinished(files: TestResult[], errors: unknown[]) {
    const endTime = performance.now()
    const totalDuration = endTime - this.startTime

    const metrics = await this.calculateMetrics(files, totalDuration)
    
    // Generate multiple report formats
    await Promise.all([
      this.generateJsonReport(metrics, files, errors),
      this.generateHtmlReport(metrics, files, errors),
      this.generateXmlReport(metrics, files, errors),
      this.generateConsoleReport(metrics),
      this.generateCoverageReport(metrics),
      this.generatePerformanceReport(metrics),
      this.generateSecurityReport(),
      this.generateTrendReport(metrics),
      this.generateCiReport(metrics, files, errors)
    ])

    // Update historical data
    await this.updateHistoricalData(metrics)

    console.log(`\n📋 Reports generated in: ${this.reportDir}`)
  }

  private async calculateMetrics(files: TestResult[], duration: number): Promise<TestMetrics> {
    const totalTests = files.reduce((acc, file) => acc + (file.tests?.length || 0), 0)
    const passedTests = files.reduce((acc, file) => 
      acc + (file.tests?.filter(t => t.result?.state === 'pass').length || 0), 0)
    const failedTests = files.reduce((acc, file) => 
      acc + (file.tests?.filter(t => t.result?.state === 'fail').length || 0), 0)
    const skippedTests = files.reduce((acc, file) => 
      acc + (file.tests?.filter(t => t.result?.state === 'skip').length || 0), 0)

    // Get slow tests
    const slowTests = files.flatMap(file => 
      file.tests?.filter(t => (t.duration || 0) > 1000)
        .map(t => ({ name: t.name, duration: t.duration || 0 })) || []
    ).sort((a, b) => b.duration - a.duration).slice(0, 10)

    // Calculate trend data
    const trends: TestTrendData = {
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      avgDuration: totalTests > 0 ? duration / totalTests : 0,
      testCount: totalTests,
      timestamp: Date.now()
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      duration,
      flaky: Array.from(this.flakyTests.keys()),
      slowTests,
      memoryUsage: process.memoryUsage(),
      trends
    }
  }

  private async generateJsonReport(metrics: TestMetrics, files: TestResult[], errors: unknown[]) {
    const report = {
      summary: {
        total: metrics.totalTests,
        passed: metrics.passedTests,
        failed: metrics.failedTests,
        skipped: metrics.skippedTests,
        passRate: metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0,
        duration: metrics.duration,
        timestamp: new Date().toISOString()
      },
      files: files.map(file => ({
        name: file.name,
        size: file.size,
        duration: file.result?.duration,
        tests: file.tests?.map(test => ({
          name: test.name,
          state: test.result?.state,
          duration: test.duration,
          errors: test.result?.errors?.map(e => e.message)
        }))
      })),
      performance: {
        slowTests: metrics.slowTests,
        memory: metrics.memoryUsage,
        flakyTests: Array.from(this.flakyTests.entries()).map(([name, data]) => ({
          name,
          failureRate: data.failures / data.runs,
          pattern: data.pattern
        }))
      },
      errors: errors.map(e => String(e)),
      trends: metrics.trends,
      security: this.securityIssues
    }

    await fs.writeJson(path.join(this.reportDir, 'comprehensive-report.json'), report, { spaces: 2 })
  }

  private async generateHtmlReport(metrics: TestMetrics, files: TestResult[], errors: unknown[]) {
    const passRate = metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0
    const statusColor = passRate >= 80 ? '#4CAF50' : passRate >= 60 ? '#FF9800' : '#F44336'

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: flex; gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; flex: 1; }
        .metric-value { font-size: 2em; font-weight: bold; color: ${statusColor}; }
        .metric-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h3 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .test-file { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .test-pass { color: #4CAF50; }
        .test-fail { color: #F44336; }
        .test-skip { color: #FF9800; }
        .flaky { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .security-issue { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .security-critical { background: #f8d7da; border: 1px solid #f5c6cb; }
        .security-high { background: #fff3cd; border: 1px solid #ffeaa7; }
        .security-medium { background: #d4edda; border: 1px solid #c3e6cb; }
        .security-low { background: #d1ecf1; border: 1px solid #bee5eb; }
        .trend-chart { height: 300px; background: #f8f9fa; border-radius: 4px; margin: 10px 0; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Unjucks Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${metrics.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${metrics.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${metrics.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${passRate.toFixed(1)}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(metrics.duration / 1000).toFixed(2)}s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="section">
            <h3>📊 Test Files</h3>
            ${files.map(file => `
                <div class="test-file">
                    <strong>${file.name}</strong> (${file.tests?.length || 0} tests)
                    <div>
                        ${file.tests?.map(test => `
                            <span class="test-${test.result?.state || 'unknown'}">${test.name}</span>
                        `).join(', ') || 'No tests'}
                    </div>
                </div>
            `).join('')}
        </div>

        ${metrics.slowTests.length > 0 ? `
        <div class="section">
            <h3>🐌 Slow Tests</h3>
            ${metrics.slowTests.map(test => `
                <div style="margin: 5px 0;">
                    <strong>${test.name}</strong>: ${test.duration.toFixed(0)}ms
                </div>
            `).join('')}
        </div>` : ''}

        ${metrics.flaky.length > 0 ? `
        <div class="section">
            <h3>🔄 Flaky Tests</h3>
            ${metrics.flaky.map(testName => {
              const data = this.flakyTests.get(testName)!
              return `
                <div class="flaky">
                    <strong>${testName}</strong> - Failure Rate: ${((data.failures / data.runs) * 100).toFixed(1)}%
                    (Pattern: ${data.pattern})
                </div>
              `
            }).join('')}
        </div>` : ''}

        ${this.securityIssues.length > 0 ? `
        <div class="section">
            <h3>🔒 Security Issues</h3>
            ${this.securityIssues.map(issue => `
                <div class="security-issue security-${issue.severity}">
                    <strong>[${issue.severity.toUpperCase()}] ${issue.type}</strong>
                    <p>${issue.description}</p>
                    ${issue.file ? `<small>File: ${issue.file}</small>` : ''}
                </div>
            `).join('')}
        </div>` : ''}

        <div class="section">
            <h3>💾 Memory Usage</h3>
            <p>Heap Used: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</p>
            <p>Heap Total: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB</p>
            <p>RSS: ${(metrics.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB</p>
        </div>

        ${errors.length > 0 ? `
        <div class="section">
            <h3>❌ Errors</h3>
            ${errors.map(error => `<p style="color: #F44336;">${String(error)}</p>`).join('')}
        </div>` : ''}
    </div>
</body>
</html>`

    await fs.writeFile(path.join(this.reportDir, 'test-report.html'), html)
  }

  private async generateXmlReport(metrics: TestMetrics, files: TestResult[], errors: unknown[]) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="unjucks" tests="${metrics.totalTests}" failures="${metrics.failedTests}" skipped="${metrics.skippedTests}" time="${metrics.duration / 1000}" timestamp="${new Date().toISOString()}">
  ${files.map(file => `
    <testcase classname="${file.name}" name="${file.name}" time="${(file.result?.duration || 0) / 1000}">
      ${file.tests?.map(test => `
        <testcase name="${test.name}" time="${(test.duration || 0) / 1000}">
          ${test.result?.state === 'fail' ? `<failure message="${test.result?.errors?.[0]?.message || 'Test failed'}">${test.result?.errors?.[0]?.stack || ''}</failure>` : ''}
          ${test.result?.state === 'skip' ? '<skipped/>' : ''}
        </testcase>
      `).join('') || ''}
    </testcase>
  `).join('')}
  ${errors.map(error => `<error message="${String(error)}"/>`).join('')}
</testsuite>`

    await fs.writeFile(path.join(this.reportDir, 'junit-report.xml'), xml)
  }

  private generateConsoleReport(metrics: TestMetrics) {
    const passRate = metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0
    const status = passRate >= 80 ? '✅' : passRate >= 60 ? '⚠️' : '❌'
    
    console.log('\n📊 Test Summary:')
    console.log(`${status} Pass Rate: ${passRate.toFixed(1)}% (${metrics.passedTests}/${metrics.totalTests})`)
    console.log(`⏱️  Duration: ${(metrics.duration / 1000).toFixed(2)}s`)
    console.log(`💾 Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    
    if (metrics.flaky.length > 0) {
      console.log(`🔄 Flaky Tests: ${metrics.flaky.length}`)
    }
    
    if (metrics.slowTests.length > 0) {
      console.log(`🐌 Slow Tests: ${metrics.slowTests.length}`)
    }

    if (this.securityIssues.length > 0) {
      console.log(`🔒 Security Issues: ${this.securityIssues.length}`)
    }
  }

  private async generateCoverageReport(metrics: TestMetrics) {
    if (!metrics.coverage) return

    const coverageReport = {
      timestamp: new Date().toISOString(),
      summary: {
        lines: metrics.coverage.lines || { total: 0, covered: 0, pct: 0 },
        functions: metrics.coverage.functions || { total: 0, covered: 0, pct: 0 },
        branches: metrics.coverage.branches || { total: 0, covered: 0, pct: 0 },
        statements: metrics.coverage.statements || { total: 0, covered: 0, pct: 0 }
      }
    }

    await fs.writeJson(path.join(this.reportDir, 'coverage-summary.json'), coverageReport, { spaces: 2 })
  }

  private async generatePerformanceReport(metrics: TestMetrics) {
    const perfReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDuration: metrics.duration,
        averageTestTime: metrics.totalTests > 0 ? metrics.duration / metrics.totalTests : 0,
        slowestTests: metrics.slowTests,
        memoryUsage: metrics.memoryUsage,
        performanceGrade: this.calculatePerformanceGrade(metrics)
      },
      recommendations: this.generatePerformanceRecommendations(metrics)
    }

    await fs.writeJson(path.join(this.reportDir, 'performance-report.json'), perfReport, { spaces: 2 })
  }

  private async generateSecurityReport() {
    const securityReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.securityIssues.length,
        critical: this.securityIssues.filter(i => i.severity === 'critical').length,
        high: this.securityIssues.filter(i => i.severity === 'high').length,
        medium: this.securityIssues.filter(i => i.severity === 'medium').length,
        low: this.securityIssues.filter(i => i.severity === 'low').length
      },
      issues: this.securityIssues,
      recommendations: this.generateSecurityRecommendations()
    }

    await fs.writeJson(path.join(this.reportDir, 'security-report.json'), securityReport, { spaces: 2 })
  }

  private async generateTrendReport(metrics: TestMetrics) {
    this.historicalData.push(metrics.trends)
    
    // Keep only last 50 runs for trend analysis
    if (this.historicalData.length > 50) {
      this.historicalData = this.historicalData.slice(-50)
    }

    const trendReport = {
      timestamp: new Date().toISOString(),
      current: metrics.trends,
      historical: this.historicalData,
      analysis: this.analyzeTrends(),
      recommendations: this.generateTrendRecommendations()
    }

    await fs.writeJson(path.join(this.reportDir, 'trend-report.json'), trendReport, { spaces: 2 })
  }

  private async generateCiReport(metrics: TestMetrics, files: TestResult[], errors: unknown[]) {
    const ciReport = {
      status: metrics.failedTests === 0 ? 'success' : 'failure',
      passRate: metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0,
      summary: {
        total: metrics.totalTests,
        passed: metrics.passedTests,
        failed: metrics.failedTests,
        skipped: metrics.skippedTests,
        duration: metrics.duration
      },
      quality: {
        flakyTests: metrics.flaky.length,
        slowTests: metrics.slowTests.length,
        securityIssues: this.securityIssues.length,
        memoryEfficiency: this.calculateMemoryEfficiency(metrics.memoryUsage)
      },
      artifacts: {
        htmlReport: 'test-report.html',
        jsonReport: 'comprehensive-report.json',
        xmlReport: 'junit-report.xml',
        coverageReport: 'coverage-summary.json',
        performanceReport: 'performance-report.json',
        securityReport: 'security-report.json',
        trendReport: 'trend-report.json'
      }
    }

    await fs.writeJson(path.join(this.reportDir, 'ci-summary.json'), ciReport, { spaces: 2 })
  }

  private trackFlakyTest(testName: string, retries: number) {
    const existing = this.flakyTests.get(testName) || {
      testName,
      failures: 0,
      runs: 0,
      lastFailure: 0,
      pattern: 'intermittent' as const
    }

    existing.failures += retries
    existing.runs += 1
    existing.lastFailure = Date.now()

    // Classify flaky test pattern
    if (existing.failures / existing.runs > 0.5) {
      existing.pattern = 'race-condition'
    } else if (existing.runs > 10 && existing.failures < 3) {
      existing.pattern = 'environment'
    } else if (existing.failures > 0 && existing.runs > 5) {
      existing.pattern = 'timing'
    }

    this.flakyTests.set(testName, existing)
  }

  private scanForSecurityIssues(test: TestResult) {
    const testContent = `${test.name} ${test.result?.errors?.map(e => e.message).join(' ') || ''}`
    
    // Pattern matching for common security issues
    const securityPatterns = [
      { pattern: /password.*=.*["'][^"']+["']/i, type: 'Hardcoded Password', severity: 'critical' as const },
      { pattern: /api[_-]?key.*=.*["'][^"']+["']/i, type: 'Hardcoded API Key', severity: 'high' as const },
      { pattern: /eval\s*\(/i, type: 'Code Injection Risk', severity: 'high' as const },
      { pattern: /document\.write\s*\(/i, type: 'XSS Risk', severity: 'medium' as const },
      { pattern: /innerHTML\s*=.*\+/i, type: 'XSS Risk', severity: 'medium' as const },
      { pattern: /exec\s*\(/i, type: 'Command Injection Risk', severity: 'high' as const },
      { pattern: /\.\.\/.*\.\.\/.*\.\.\//i, type: 'Directory Traversal', severity: 'medium' as const }
    ]

    for (const { pattern, type, severity } of securityPatterns) {
      if (pattern.test(testContent)) {
        this.securityIssues.push({
          type,
          severity,
          description: `Detected in test: ${test.name}`,
          file: test.meta?.file
        })
      }
    }
  }

  private calculatePerformanceGrade(metrics: TestMetrics): 'A' | 'B' | 'C' | 'D' | 'F' {
    const avgTime = metrics.totalTests > 0 ? metrics.duration / metrics.totalTests : 0
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024
    
    if (avgTime < 100 && memoryMB < 50) return 'A'
    if (avgTime < 500 && memoryMB < 100) return 'B'
    if (avgTime < 1000 && memoryMB < 200) return 'C'
    if (avgTime < 2000 && memoryMB < 500) return 'D'
    return 'F'
  }

  private generatePerformanceRecommendations(metrics: TestMetrics): string[] {
    const recommendations: string[] = []
    
    if (metrics.slowTests.length > 0) {
      recommendations.push('Optimize slow tests - consider mocking external dependencies')
    }
    
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024
    if (memoryMB > 200) {
      recommendations.push('High memory usage detected - review test cleanup and object disposal')
    }
    
    if (metrics.flaky.length > 0) {
      recommendations.push('Fix flaky tests to improve reliability and reduce CI/CD time')
    }

    return recommendations
  }

  private generateSecurityRecommendations(): string[] {
    const recommendations: string[] = []
    
    if (this.securityIssues.some(i => i.severity === 'critical')) {
      recommendations.push('Critical security issues found - address immediately')
    }
    
    if (this.securityIssues.some(i => i.type.includes('Hardcoded'))) {
      recommendations.push('Use environment variables or secure vaults for sensitive data')
    }
    
    if (this.securityIssues.some(i => i.type.includes('Injection'))) {
      recommendations.push('Implement input validation and sanitization')
    }

    return recommendations
  }

  private analyzeTrends(): { trend: 'improving' | 'stable' | 'declining'; confidence: number } {
    if (this.historicalData.length < 5) {
      return { trend: 'stable', confidence: 0 }
    }

    const recent = this.historicalData.slice(-5)
    const older = this.historicalData.slice(-10, -5)
    
    if (older.length === 0) {
      return { trend: 'stable', confidence: 0 }
    }

    const recentAvg = recent.reduce((sum, d) => sum + d.passRate, 0) / recent.length
    const olderAvg = older.reduce((sum, d) => sum + d.passRate, 0) / older.length
    
    const difference = recentAvg - olderAvg
    const confidence = Math.min(Math.abs(difference) * 10, 100) // 0-100 confidence
    
    if (difference > 2) return { trend: 'improving', confidence }
    if (difference < -2) return { trend: 'declining', confidence }
    return { trend: 'stable', confidence }
  }

  private generateTrendRecommendations(): string[] {
    const analysis = this.analyzeTrends()
    const recommendations: string[] = []
    
    switch (analysis.trend) {
      case 'declining':
        recommendations.push('Test quality is declining - review recent changes')
        recommendations.push('Consider increasing test coverage and code review rigor')
        break
      case 'improving':
        recommendations.push('Test quality is improving - maintain current practices')
        break
      case 'stable':
        recommendations.push('Test quality is stable - consider optimization opportunities')
        break
    }

    return recommendations
  }

  private calculateMemoryEfficiency(memory: NodeJS.MemoryUsage): number {
    const heapUsedMB = memory.heapUsed / 1024 / 1024
    // Efficiency score: 100 = very efficient (<50MB), 0 = very inefficient (>500MB)
    return Math.max(0, Math.min(100, 100 - (heapUsedMB - 50) * 2))
  }

  private async loadHistoricalData() {
    try {
      const data = await fs.readJson(path.join(this.reportDir, 'trend-report.json'))
      this.historicalData = data.historical || []
    } catch {
      this.historicalData = []
    }
  }

  private async updateHistoricalData(metrics: TestMetrics) {
    // Historical data is saved in generateTrendReport
  }
}

// Export singleton instance
export const comprehensiveReporter = new ComprehensiveReporter()