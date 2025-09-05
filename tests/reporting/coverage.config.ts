import type { CoverageConfig } from 'vitest/config'
import { defineConfig } from 'vitest/config'

export interface CoverageThreshold {
  statements: number
  branches: number
  functions: number
  lines: number
}

export interface ComponentThresholds {
  [key: string]: CoverageThreshold
}

export class CoverageConfiguration {
  // Base coverage thresholds
  static readonly GLOBAL_THRESHOLDS: CoverageThreshold = {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  }

  // Component-specific thresholds for critical paths
  static readonly COMPONENT_THRESHOLDS: ComponentThresholds = {
    // Core generator engine - highest standards
    'src/lib/generator.ts': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95
    },
    'src/lib/template-scanner.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },
    'src/lib/dynamic-commands.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    'src/lib/frontmatter.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    'src/lib/file-injection.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },
    'src/lib/prompts.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    // Command files - moderate thresholds (CLI wrappers)
    'src/commands/**/*.ts': {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75
    },
    // Utilities and helpers
    'src/utils/**/*.ts': {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  }

  // Files to always exclude from coverage
  static readonly EXCLUDE_PATTERNS = [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/*.bench.ts',
    'src/**/*.d.ts',
    'src/**/types.ts',
    'src/cli.ts', // CLI entry point
    'tests/**/*.ts',
    'tests/step-definitions/**/*.ts',
    'tests/support/**/*.ts',
    'tests/fixtures/**/*.ts',
    '**/*.config.ts',
    '**/dist/**',
    '**/node_modules/**',
    '**/generated/**'
  ]

  // Coverage reporters configuration
  static readonly REPORTERS = [
    'text',        // Console output
    'text-summary', // Brief summary
    'html',        // Interactive HTML report
    'json',        // Machine-readable JSON
    'json-summary', // Summary JSON
    'lcov',        // LCOV format for CI/CD
    'clover',      // Clover XML format
    'cobertura'    // Cobertura XML format
  ] as const

  // Generate comprehensive coverage configuration
  static generateConfig(): CoverageConfig {
    return {
      enabled: true,
      provider: 'v8', // Use V8 coverage (faster and more accurate than Istanbul)
      
      // Include patterns
      include: ['src/**/*.ts'],
      
      // Exclude patterns
      exclude: this.EXCLUDE_PATTERNS,
      
      // All coverage data will be collected
      all: true,
      
      // Clean coverage directory before each run
      clean: true,
      
      // Clean temporary files
      cleanOnRerun: true,
      
      // Report directory
      reportsDirectory: 'coverage',
      
      // Multiple reporters for different use cases
      reporter: this.REPORTERS,
      
      // Threshold configuration
      thresholds: {
        global: this.GLOBAL_THRESHOLDS,
        ...this.COMPONENT_THRESHOLDS
      },
      
      // Report uncovered lines
      reportOnFailure: true,
      
      // Skip full coverage report if thresholds fail
      skipFull: false,
      
      // Watermarks for coverage visualization
      watermarks: {
        statements: [50, 80],
        functions: [50, 80],
        branches: [50, 80],
        lines: [50, 80]
      },
      
      // Allow empty coverage (for new projects)
      allowExternal: false,
      
      // Extension to coverage reporters
      extension: ['.ts', '.tsx', '.js', '.jsx'],
      
      // Source maps for accurate line mapping
      processingConcurrency: 4,
      
      // Advanced V8 configuration
      ignoreEmptyLines: true,
      
      // Custom report configuration
      customReportsDirectory: 'reports/coverage'
    }
  }

  // Generate coverage report analysis
  static analyzeCoverageReport(coverageData: any): {
    status: 'excellent' | 'good' | 'fair' | 'poor'
    recommendations: string[]
    criticalFiles: string[]
    improvementAreas: string[]
  } {
    const totalStatements = coverageData.total?.statements?.pct || 0
    const totalBranches = coverageData.total?.branches?.pct || 0
    const totalFunctions = coverageData.total?.functions?.pct || 0
    const totalLines = coverageData.total?.lines?.pct || 0
    
    const average = (totalStatements + totalBranches + totalFunctions + totalLines) / 4
    
    let status: 'excellent' | 'good' | 'fair' | 'poor'
    if (average >= 90) status = 'excellent'
    else if (average >= 80) status = 'good'
    else if (average >= 70) status = 'fair'
    else status = 'poor'

    const recommendations: string[] = []
    const criticalFiles: string[] = []
    const improvementAreas: string[] = []

    // Analyze by coverage type
    if (totalStatements < 80) {
      recommendations.push('Increase statement coverage by adding more unit tests')
      improvementAreas.push('Statement Coverage')
    }
    
    if (totalBranches < 75) {
      recommendations.push('Improve branch coverage by testing edge cases and error conditions')
      improvementAreas.push('Branch Coverage')
    }
    
    if (totalFunctions < 80) {
      recommendations.push('Ensure all functions are tested, including private/internal functions')
      improvementAreas.push('Function Coverage')
    }
    
    if (totalLines < 80) {
      recommendations.push('Add tests for uncovered code lines')
      improvementAreas.push('Line Coverage')
    }

    // Identify critical files with low coverage
    if (coverageData.files) {
      Object.entries(coverageData.files).forEach(([file, data]: [string, any]) => {
        const fileAverage = (
          (data.statements?.pct || 0) +
          (data.branches?.pct || 0) +
          (data.functions?.pct || 0) +
          (data.lines?.pct || 0)
        ) / 4

        if (fileAverage < 70 && file.includes('src/lib/')) {
          criticalFiles.push(file)
        }
      })
    }

    // Status-specific recommendations
    switch (status) {
      case 'excellent':
        recommendations.push('Maintain current testing practices')
        recommendations.push('Consider property-based testing for edge cases')
        break
      case 'good':
        recommendations.push('Focus on improving branch coverage')
        recommendations.push('Add integration tests for critical paths')
        break
      case 'fair':
        recommendations.push('Prioritize testing core business logic')
        recommendations.push('Implement code coverage gates in CI/CD')
        break
      case 'poor':
        recommendations.push('Urgent: Implement comprehensive test strategy')
        recommendations.push('Start with unit tests for critical components')
        recommendations.push('Consider test-driven development approach')
        break
    }

    return {
      status,
      recommendations,
      criticalFiles,
      improvementAreas
    }
  }

  // Generate HTML coverage report with custom styling
  static generateEnhancedHtmlReport(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Unjucks Coverage Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f8f9fa; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .metric-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; text-transform: uppercase; font-size: 0.9em; }
        .excellent { color: #27ae60; }
        .good { color: #3498db; }
        .fair { color: #f39c12; }
        .poor { color: #e74c3c; }
        .files-table { background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .files-table table { width: 100%; border-collapse: collapse; }
        .files-table th, .files-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .files-table th { background: #34495e; color: white; }
        .progress-bar { height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .recommendations { background: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .recommendation { padding: 10px; margin: 5px 0; border-left: 4px solid #3498db; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Unjucks Coverage Report</h1>
        <p>Comprehensive code coverage analysis</p>
    </div>
    
    <div class="container">
        <!-- Coverage metrics will be injected here -->
        <div id="coverage-data"></div>
    </div>

    <script>
        // Enhanced coverage visualization
        function renderCoverageData(data) {
            // Implementation would load actual coverage data
            document.getElementById('coverage-data').innerHTML = \`
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value excellent">\${data.statements}%</div>
                        <div class="metric-label">Statements</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value good">\${data.branches}%</div>
                        <div class="metric-label">Branches</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value excellent">\${data.functions}%</div>
                        <div class="metric-label">Functions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value good">\${data.lines}%</div>
                        <div class="metric-label">Lines</div>
                    </div>
                </div>
            \`;
        }
    </script>
</body>
</html>`
  }
}

// Default export for vitest config integration
export default CoverageConfiguration.generateConfig()