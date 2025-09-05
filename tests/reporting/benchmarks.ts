import { performance } from 'perf_hooks'
import fs from 'fs-extra'
import path from 'path'
import type { BenchmarkResult, PerformanceMetrics } from 'vitest'

export interface BenchmarkReport {
  timestamp: string
  environment: {
    nodeVersion: string
    platform: string
    cpuModel: string
    memoryTotal: number
  }
  results: BenchmarkTestResult[]
  summary: BenchmarkSummary
  regressions: RegressionAnalysis[]
  recommendations: string[]
}

export interface BenchmarkTestResult {
  name: string
  suite: string
  duration: {
    mean: number
    median: number
    min: number
    max: number
    stdDev: number
  }
  throughput: {
    opsPerSec: number
    samplesCount: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
  }
  percentiles: {
    p50: number
    p75: number
    p90: number
    p95: number
    p99: number
  }
  status: 'fast' | 'acceptable' | 'slow' | 'critical'
  baseline?: number // For regression detection
}

export interface BenchmarkSummary {
  totalTests: number
  fastTests: number
  acceptableTests: number
  slowTests: number
  criticalTests: number
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  performanceScore: number
}

export interface RegressionAnalysis {
  testName: string
  currentValue: number
  baselineValue: number
  regressionPercent: number
  severity: 'minor' | 'moderate' | 'major' | 'critical'
  trend: 'improving' | 'stable' | 'declining'
}

export class BenchmarkReporter {
  private reportDir = 'reports/performance'
  private baselineData: Map<string, number> = new Map()
  private historicalData: BenchmarkReport[] = []

  async initialize() {
    await fs.ensureDir(this.reportDir)
    await this.loadBaseline()
    await this.loadHistoricalData()
  }

  async generateReport(results: BenchmarkResult[]): Promise<BenchmarkReport> {
    const environment = await this.getEnvironmentInfo()
    const processedResults = await this.processResults(results)
    const summary = this.calculateSummary(processedResults)
    const regressions = this.analyzeRegressions(processedResults)
    const recommendations = this.generateRecommendations(processedResults, regressions)

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      environment,
      results: processedResults,
      summary,
      regressions,
      recommendations
    }

    await this.saveReport(report)
    await this.updateBaseline(processedResults)
    await this.generateVisualReports(report)

    return report
  }

  private async processResults(results: BenchmarkResult[]): Promise<BenchmarkTestResult[]> {
    return results.map(result => {
      const samples = result.samples || []
      const sortedSamples = [...samples].sort((a, b) => a - b)
      
      const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length
      const median = sortedSamples[Math.floor(sortedSamples.length / 2)]
      const min = Math.min(...samples)
      const max = Math.max(...samples)
      const stdDev = Math.sqrt(
        samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length
      )

      const opsPerSec = 1000 / mean // Convert ms to ops/sec
      const baseline = this.baselineData.get(result.name)
      
      // Performance thresholds
      let status: 'fast' | 'acceptable' | 'slow' | 'critical'
      if (mean < 10) status = 'fast'
      else if (mean < 100) status = 'acceptable'
      else if (mean < 1000) status = 'slow'
      else status = 'critical'

      return {
        name: result.name,
        suite: result.meta?.suite || 'benchmark',
        duration: {
          mean,
          median,
          min,
          max,
          stdDev
        },
        throughput: {
          opsPerSec,
          samplesCount: samples.length
        },
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss
        },
        percentiles: {
          p50: this.calculatePercentile(sortedSamples, 50),
          p75: this.calculatePercentile(sortedSamples, 75),
          p90: this.calculatePercentile(sortedSamples, 90),
          p95: this.calculatePercentile(sortedSamples, 95),
          p99: this.calculatePercentile(sortedSamples, 99)
        },
        status,
        baseline
      }
    })
  }

  private calculateSummary(results: BenchmarkTestResult[]): BenchmarkSummary {
    const totalTests = results.length
    const fastTests = results.filter(r => r.status === 'fast').length
    const acceptableTests = results.filter(r => r.status === 'acceptable').length
    const slowTests = results.filter(r => r.status === 'slow').length
    const criticalTests = results.filter(r => r.status === 'critical').length

    // Performance score based on distribution
    const performanceScore = Math.round(
      (fastTests * 100 + acceptableTests * 80 + slowTests * 60 + criticalTests * 20) / totalTests
    )

    // Overall grade
    let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (performanceScore >= 90) overallGrade = 'A'
    else if (performanceScore >= 80) overallGrade = 'B'
    else if (performanceScore >= 70) overallGrade = 'C'
    else if (performanceScore >= 60) overallGrade = 'D'
    else overallGrade = 'F'

    return {
      totalTests,
      fastTests,
      acceptableTests,
      slowTests,
      criticalTests,
      overallGrade,
      performanceScore
    }
  }

  private analyzeRegressions(results: BenchmarkTestResult[]): RegressionAnalysis[] {
    const regressions: RegressionAnalysis[] = []

    for (const result of results) {
      if (result.baseline) {
        const regressionPercent = ((result.duration.mean - result.baseline) / result.baseline) * 100
        
        let severity: RegressionAnalysis['severity']
        if (Math.abs(regressionPercent) < 5) continue // Skip minor variations
        else if (Math.abs(regressionPercent) < 15) severity = 'minor'
        else if (Math.abs(regressionPercent) < 30) severity = 'moderate'
        else if (Math.abs(regressionPercent) < 50) severity = 'major'
        else severity = 'critical'

        const trend = regressionPercent > 0 ? 'declining' : 'improving'

        regressions.push({
          testName: result.name,
          currentValue: result.duration.mean,
          baselineValue: result.baseline,
          regressionPercent,
          severity,
          trend
        })
      }
    }

    return regressions.sort((a, b) => Math.abs(b.regressionPercent) - Math.abs(a.regressionPercent))
  }

  private generateRecommendations(results: BenchmarkTestResult[], regressions: RegressionAnalysis[]): string[] {
    const recommendations: string[] = []

    // Critical performance issues
    const criticalTests = results.filter(r => r.status === 'critical')
    if (criticalTests.length > 0) {
      recommendations.push(`🚨 ${criticalTests.length} critical performance issues detected - immediate optimization required`)
      criticalTests.forEach(test => {
        recommendations.push(`   - ${test.name}: ${test.duration.mean.toFixed(2)}ms (target: <1000ms)`)
      })
    }

    // Slow tests
    const slowTests = results.filter(r => r.status === 'slow')
    if (slowTests.length > 0) {
      recommendations.push(`⚠️ ${slowTests.length} slow operations detected - optimization recommended`)
    }

    // Significant regressions
    const majorRegressions = regressions.filter(r => r.severity === 'major' || r.severity === 'critical')
    if (majorRegressions.length > 0) {
      recommendations.push(`📉 ${majorRegressions.length} performance regressions detected`)
      majorRegressions.forEach(regression => {
        recommendations.push(`   - ${regression.testName}: ${regression.regressionPercent.toFixed(1)}% slower`)
      })
    }

    // Memory recommendations
    const highMemoryTests = results.filter(r => r.memory.heapUsed > 100 * 1024 * 1024) // >100MB
    if (highMemoryTests.length > 0) {
      recommendations.push(`💾 High memory usage in ${highMemoryTests.length} tests - review memory management`)
    }

    // Variability concerns
    const inconsistentTests = results.filter(r => r.duration.stdDev > r.duration.mean * 0.5)
    if (inconsistentTests.length > 0) {
      recommendations.push(`📊 ${inconsistentTests.length} tests show high variability - consider environment factors`)
    }

    // General performance tips
    if (results.some(r => r.status === 'slow' || r.status === 'critical')) {
      recommendations.push('🔧 Performance optimization techniques:')
      recommendations.push('   - Cache expensive computations')
      recommendations.push('   - Use streaming for large data processing')
      recommendations.push('   - Implement lazy loading where appropriate')
      recommendations.push('   - Profile code to identify bottlenecks')
    }

    return recommendations
  }

  private async saveReport(report: BenchmarkReport) {
    // Save detailed JSON report
    await fs.writeJson(
      path.join(this.reportDir, 'benchmark-report.json'), 
      report, 
      { spaces: 2 }
    )

    // Save summary for quick access
    const summary = {
      timestamp: report.timestamp,
      grade: report.summary.overallGrade,
      score: report.summary.performanceScore,
      tests: {
        total: report.summary.totalTests,
        critical: report.summary.criticalTests,
        slow: report.summary.slowTests
      },
      regressions: report.regressions.length
    }

    await fs.writeJson(
      path.join(this.reportDir, 'performance-summary.json'),
      summary,
      { spaces: 2 }
    )
  }

  private async generateVisualReports(report: BenchmarkReport) {
    // Generate HTML report
    const html = await this.generateHtmlReport(report)
    await fs.writeFile(path.join(this.reportDir, 'performance-report.html'), html)

    // Generate CSV for analysis
    const csv = await this.generateCsvReport(report)
    await fs.writeFile(path.join(this.reportDir, 'performance-data.csv'), csv)

    // Generate performance chart data
    const chartData = await this.generateChartData(report)
    await fs.writeJson(path.join(this.reportDir, 'chart-data.json'), chartData, { spaces: 2 })
  }

  private async generateHtmlReport(report: BenchmarkReport): Promise<string> {
    const gradeColors = {
      A: '#27ae60',
      B: '#3498db', 
      C: '#f39c12',
      D: '#e67e22',
      F: '#e74c3c'
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        .metric-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; text-transform: uppercase; }
        .grade-${report.summary.overallGrade.toLowerCase()} { color: ${gradeColors[report.summary.overallGrade]}; }
        .results-table { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .results-table table { width: 100%; border-collapse: collapse; }
        .results-table th, .results-table td { padding: 12px; text-align: left; }
        .results-table th { background: #2c3e50; color: white; }
        .results-table tbody tr:nth-child(even) { background: #f8f9fa; }
        .status-fast { color: #27ae60; font-weight: bold; }
        .status-acceptable { color: #3498db; font-weight: bold; }
        .status-slow { color: #f39c12; font-weight: bold; }
        .status-critical { color: #e74c3c; font-weight: bold; }
        .regressions { background: white; padding: 20px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .regression { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .regression-critical { background: #fee; border-left: 4px solid #e74c3c; }
        .regression-major { background: #fff3cd; border-left: 4px solid #f39c12; }
        .regression-moderate { background: #e3f2fd; border-left: 4px solid #3498db; }
        .regression-minor { background: #f1f8e9; border-left: 4px solid #27ae60; }
        .recommendations { background: white; padding: 20px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .recommendation { padding: 10px; margin: 5px 0; background: #f8f9fa; border-left: 4px solid #3498db; }
        .chart-container { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Benchmark Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Environment: ${report.environment.platform} | Node ${report.environment.nodeVersion}</p>
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value grade-${report.summary.overallGrade.toLowerCase()}">${report.summary.overallGrade}</div>
                <div class="metric-label">Overall Grade</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.performanceScore}</div>
                <div class="metric-label">Performance Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value status-critical">${report.summary.criticalTests}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
        </div>

        <div class="chart-container">
            <h3>Performance Distribution</h3>
            <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>

        <div class="results-table">
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Mean Duration</th>
                        <th>Ops/Sec</th>
                        <th>Status</th>
                        <th>P95</th>
                        <th>Std Dev</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.results.map(result => `
                        <tr>
                            <td>${result.name}</td>
                            <td>${result.duration.mean.toFixed(2)}ms</td>
                            <td>${result.throughput.opsPerSec.toFixed(0)}</td>
                            <td class="status-${result.status}">${result.status.toUpperCase()}</td>
                            <td>${result.percentiles.p95.toFixed(2)}ms</td>
                            <td>${result.duration.stdDev.toFixed(2)}ms</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${report.regressions.length > 0 ? `
        <div class="regressions">
            <h3>📉 Performance Regressions</h3>
            ${report.regressions.map(regression => `
                <div class="regression regression-${regression.severity}">
                    <strong>${regression.testName}</strong>: 
                    ${regression.regressionPercent.toFixed(1)}% ${regression.trend === 'declining' ? 'slower' : 'faster'}
                    (${regression.currentValue.toFixed(2)}ms vs ${regression.baselineValue.toFixed(2)}ms baseline)
                </div>
            `).join('')}
        </div>` : ''}

        <div class="recommendations">
            <h3>💡 Recommendations</h3>
            ${report.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
        </div>
    </div>

    <script>
        // Performance distribution chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Fast', 'Acceptable', 'Slow', 'Critical'],
                datasets: [{
                    data: [${report.summary.fastTests}, ${report.summary.acceptableTests}, ${report.summary.slowTests}, ${report.summary.criticalTests}],
                    backgroundColor: ['#27ae60', '#3498db', '#f39c12', '#e74c3c'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    </script>
</body>
</html>`
  }

  private async generateCsvReport(report: BenchmarkReport): Promise<string> {
    const headers = [
      'Test Name',
      'Suite',
      'Mean Duration (ms)',
      'Median Duration (ms)',
      'Min Duration (ms)', 
      'Max Duration (ms)',
      'Std Dev (ms)',
      'Ops/Sec',
      'P50 (ms)',
      'P95 (ms)',
      'P99 (ms)',
      'Status',
      'Memory Heap (MB)',
      'Memory RSS (MB)'
    ].join(',')

    const rows = report.results.map(result => [
      `"${result.name}"`,
      `"${result.suite}"`,
      result.duration.mean.toFixed(3),
      result.duration.median.toFixed(3),
      result.duration.min.toFixed(3),
      result.duration.max.toFixed(3),
      result.duration.stdDev.toFixed(3),
      result.throughput.opsPerSec.toFixed(0),
      result.percentiles.p50.toFixed(3),
      result.percentiles.p95.toFixed(3),
      result.percentiles.p99.toFixed(3),
      result.status,
      (result.memory.heapUsed / 1024 / 1024).toFixed(2),
      (result.memory.rss / 1024 / 1024).toFixed(2)
    ].join(','))

    return [headers, ...rows].join('\n')
  }

  private async generateChartData(report: BenchmarkReport) {
    return {
      timestamp: report.timestamp,
      performance: {
        distribution: {
          fast: report.summary.fastTests,
          acceptable: report.summary.acceptableTests,
          slow: report.summary.slowTests,
          critical: report.summary.criticalTests
        },
        scores: report.results.map(r => ({
          name: r.name,
          duration: r.duration.mean,
          throughput: r.throughput.opsPerSec,
          status: r.status
        })),
        trends: this.historicalData.slice(-10).map(h => ({
          timestamp: h.timestamp,
          score: h.summary.performanceScore,
          grade: h.summary.overallGrade
        }))
      },
      regressions: report.regressions.map(r => ({
        name: r.testName,
        current: r.currentValue,
        baseline: r.baselineValue,
        change: r.regressionPercent,
        severity: r.severity
      }))
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (lower === upper) {
      return sortedValues[lower]
    }
    
    const weight = index - lower
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
  }

  private async getEnvironmentInfo() {
    const os = await import('os')
    return {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpuModel: os.cpus()[0].model,
      memoryTotal: os.totalmem()
    }
  }

  private async loadBaseline() {
    try {
      const baselineFile = path.join(this.reportDir, 'baseline.json')
      const baseline = await fs.readJson(baselineFile)
      this.baselineData = new Map(Object.entries(baseline))
    } catch {
      this.baselineData = new Map()
    }
  }

  private async loadHistoricalData() {
    try {
      const historyFile = path.join(this.reportDir, 'history.json')
      this.historicalData = await fs.readJson(historyFile)
    } catch {
      this.historicalData = []
    }
  }

  private async updateBaseline(results: BenchmarkTestResult[]) {
    const newBaseline: Record<string, number> = {}
    results.forEach(result => {
      newBaseline[result.name] = result.duration.mean
    })

    await fs.writeJson(
      path.join(this.reportDir, 'baseline.json'),
      newBaseline,
      { spaces: 2 }
    )
  }
}

// Export singleton instance
export const benchmarkReporter = new BenchmarkReporter()