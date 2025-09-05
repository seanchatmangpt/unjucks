/**
 * Comprehensive Test Reporting System
 * 
 * This module provides a unified interface for all test reporting capabilities
 * across the Unjucks project, including BDD, unit, performance, and security testing.
 */

export { comprehensiveReporter, ComprehensiveReporter } from './reporter'
export { default as CoverageConfiguration } from './coverage.config'
export { benchmarkReporter, BenchmarkReporter } from './benchmarks'
export { securityReporter, SecurityReporter } from './security'

// Re-export types for external use
export type {
  TestMetrics,
  TestTrendData,
  FlakyTestData
} from './reporter'

export type {
  CoverageThreshold,
  ComponentThresholds
} from './coverage.config'

export type {
  BenchmarkReport,
  BenchmarkTestResult,
  BenchmarkSummary,
  RegressionAnalysis,
  PerformanceMetrics
} from './benchmarks'

export type {
  SecurityVulnerability,
  SecurityVulnerabilityType,
  SecurityReport,
  DependencySecurityAnalysis,
  SecurityRecommendation,
  ComplianceCheck,
  SecurityTrendData
} from './security'

/**
 * Initialize all reporting systems
 */
export async function initializeReporting(): Promise<void> {
  console.log('🔧 Initializing comprehensive test reporting...')
  
  try {
    await Promise.all([
      comprehensiveReporter.onInit({}),
      benchmarkReporter.initialize(),
      securityReporter.initialize()
    ])
    
    console.log('✅ Test reporting initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize test reporting:', error)
    throw error
  }
}

/**
 * Generate all reports for a complete test run
 */
export async function generateAllReports(options: {
  sourceFiles?: string[]
  testResults?: any[]
  benchmarkResults?: any[]
  coverageData?: any
}): Promise<{
  securityReport?: any
  benchmarkReport?: any
  coverageAnalysis?: any
}> {
  const results: any = {}
  
  try {
    // Generate security report if source files provided
    if (options.sourceFiles && options.sourceFiles.length > 0) {
      console.log('🔒 Generating security report...')
      results.securityReport = await securityReporter.generateSecurityReport(options.sourceFiles)
    }
    
    // Generate benchmark report if results provided
    if (options.benchmarkResults && options.benchmarkResults.length > 0) {
      console.log('📊 Generating performance report...')
      results.benchmarkReport = await benchmarkReporter.generateReport(options.benchmarkResults)
    }
    
    // Analyze coverage data if provided
    if (options.coverageData) {
      console.log('📋 Analyzing coverage report...')
      results.coverageAnalysis = CoverageConfiguration.analyzeCoverageReport(options.coverageData)
    }
    
    console.log('✅ All reports generated successfully')
    return results
  } catch (error) {
    console.error('❌ Failed to generate reports:', error)
    throw error
  }
}

/**
 * Utility function to clean up old reports
 */
export async function cleanupOldReports(retentionDays: number = 30): Promise<void> {
  const fs = await import('fs-extra')
  const path = await import('path')
  
  const reportsDir = 'reports'
  const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000))
  
  try {
    if (await fs.pathExists(reportsDir)) {
      const subdirs = ['security', 'performance', 'coverage', 'cucumber']
      
      for (const subdir of subdirs) {
        const fullPath = path.join(reportsDir, subdir)
        if (await fs.pathExists(fullPath)) {
          const files = await fs.readdir(fullPath)
          
          for (const file of files) {
            const filePath = path.join(fullPath, file)
            const stats = await fs.stat(filePath)
            
            if (stats.mtime < cutoffDate) {
              await fs.remove(filePath)
              console.log(`🗑️ Cleaned up old report: ${filePath}`)
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Warning during report cleanup:', error)
  }
}

// Default export with main functionality
export default {
  initializeReporting,
  generateAllReports,
  cleanupOldReports,
  reporters: {
    comprehensive: comprehensiveReporter,
    benchmark: benchmarkReporter,
    security: securityReporter
  },
  config: {
    coverage: CoverageConfiguration
  }
}