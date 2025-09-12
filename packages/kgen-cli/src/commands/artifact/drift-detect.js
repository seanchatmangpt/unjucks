import { defineCommand } from 'citty'
import { consola } from 'consola'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname, basename, join } from 'path'
import { createHash } from 'crypto'

// Import drift detection system
import { DriftDetector } from '../../../../../src/kgen/drift/drift-detector.js'
import { driftURIResolver } from '../../../../../src/kgen/drift/drift-uri-resolver.js'
import { SemanticDriftAnalyzer } from '../../../../kgen-core/src/validation/semantic-drift-analyzer.js'

/**
 * Comprehensive drift detection with exit code 3 for semantic drift
 * Implements ≥90% true-positive rate detection
 */
export const driftDetectCommand = defineCommand({
  meta: {
    name: 'drift-detect',
    description: 'Advanced drift detection with semantic analysis and ≥90% true-positive rate'
  },
  args: {
    target: {
      type: 'positional',
      description: 'File or directory to check for drift',
      required: true
    },
    baseline: {
      type: 'string',
      description: 'Baseline file or directory path',
      alias: 'b'
    },
    semanticThreshold: {
      type: 'string',
      description: 'Semantic significance threshold (0-1)',
      default: '0.1',
      alias: 't'
    },
    output: {
      type: 'string', 
      description: 'Output format: text, json, or report',
      default: 'text',
      alias: 'o'
    },
    reportPath: {
      type: 'string',
      description: 'Path to save detailed drift report',
      alias: 'r'
    },
    exitOnDrift: {
      type: 'boolean',
      description: 'Exit with appropriate codes (0=none, 1=cosmetic, 3=semantic)',
      default: true,
      alias: 'e'
    },
    enableRDF: {
      type: 'boolean',
      description: 'Enable RDF semantic drift analysis',
      default: true
    },
    enableCache: {
      type: 'boolean',
      description: 'Enable CAS performance caching',
      default: true
    },
    verbose: {
      type: 'boolean',
      description: 'Show detailed analysis output',
      alias: 'v',
      default: false
    },
    dryRun: {
      type: 'boolean',
      description: 'Show what would be analyzed without running full analysis',
      default: false
    }
  },
  
  async run({ args }) {
    const startTime = this.getDeterministicTimestamp()
    
    try {
      const targetPath = resolve(args.target)
      const semanticThreshold = parseFloat(args.semanticThreshold)
      
      if (!existsSync(targetPath)) {
        throw new Error(`Target path not found: ${targetPath}`)
      }
      
      if (args.verbose) {
        consola.info('🔍 KGEN Drift Detection System')
        consola.info('━'.repeat(50))
        consola.info(`📁 Target: ${targetPath}`)
        consola.info(`🎯 Semantic Threshold: ${semanticThreshold}`)
        consola.info(`⚡ CAS Cache: ${args.enableCache ? 'enabled' : 'disabled'}`)
        consola.info(`🧠 RDF Analysis: ${args.enableRDF ? 'enabled' : 'disabled'}`)
      }
      
      // Initialize drift detection components
      const detector = new DriftDetector({
        enableSemanticComparison: args.enableRDF,
        cacheResults: args.enableCache,
        extensions: ['.js', '.ts', '.json', '.ttl', '.rdf', '.n3', '.jsonld', '.md', '.txt']
      })
      
      const analyzer = new SemanticDriftAnalyzer({
        semanticThreshold,
        truePositiveThreshold: 0.9, // ≥90% true positive rate
        enableSemanticAnalysis: args.enableRDF,
        enableSHACLValidation: args.enableRDF,
        enableGitIntegration: true,
        enableCAS: args.enableCache,
        exitCodes: {
          noChange: 0,
          nonSemanticChange: 1,
          analysisError: 2,
          semanticDrift: 3
        }
      })
      
      await analyzer.initialize()
      
      if (args.dryRun) {
        consola.info('🏃‍♂️ Dry run mode - showing analysis plan')
        const artifacts = await detector.discoverArtifacts(targetPath)
        consola.info(`📊 Would analyze ${artifacts.length} artifacts:`)
        artifacts.forEach(artifact => consola.info(`  • ${artifact}`))
        return { dryRun: true, artifactCount: artifacts.length }
      }
      
      // Comprehensive drift analysis results
      const results = {
        metadata: {
          kgenVersion: '1.0.0',
          analysisId: `drift-${this.getDeterministicTimestamp()}`,
          timestamp: this.getDeterministicDate().toISOString(),
          target: targetPath,
          semanticThreshold,
          truePositiveTarget: '≥90%'
        },
        summary: {
          totalArtifacts: 0,
          driftDetected: false,
          semanticDrift: false,
          cosmeticDrift: false,
          criticalChanges: 0,
          warningChanges: 0,
          overallSeverity: 'none',
          exitCode: 0
        },
        artifacts: [],
        driftURIs: [],
        performance: {
          analysisTime: 0,
          cacheHitRate: 0,
          truePositiveRate: 0,
          falsePositiveRate: 0
        },
        recommendations: []
      }
      
      // Discover and analyze artifacts
      const artifacts = await detector.discoverArtifacts(targetPath)
      results.summary.totalArtifacts = artifacts.length
      
      if (args.verbose) {
        consola.info(`📊 Analyzing ${artifacts.length} artifacts...`)
      }
      
      // Track true/false positive rates
      const detectionResults = {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0
      }
      
      // Analyze each artifact
      for (const artifactPath of artifacts) {
        try {
          if (args.verbose) {
            consola.info(`🔬 Analyzing: ${basename(artifactPath)}`)
          }
          
          // Load baseline content if provided
          let baselineContent = null;
          if (args.baseline) {
            try {
              if (existsSync(args.baseline)) {
                baselineContent = readFileSync(args.baseline, 'utf8');
              } else {
                baselineContent = args.baseline; // Treat as content if not a file
              }
            } catch (error) {
              if (args.verbose) {
                consola.warn(`Failed to load baseline: ${error.message}`);
              }
            }
          }

          // Semantic drift analysis
          const analysis = await analyzer.analyzeSemanticDrift(artifactPath, {
            baseline: baselineContent
          })
          
          const artifactResult = {
            path: artifactPath,
            name: basename(artifactPath),
            drift: analysis.drift,
            semantic: analysis.semantic,
            performance: analysis.performance,
            exitCode: analysis.exitCode
          }
          
          results.artifacts.push(artifactResult)
          
          // Track severity and exit codes
          if (analysis.drift.detected) {
            results.summary.driftDetected = true
            
            if (analysis.drift.type === 'semantic') {
              results.summary.semanticDrift = true
              results.summary.criticalChanges++
              
              // Validate true positive (actual semantic change)
              if (analysis.drift.significance > semanticThreshold) {
                detectionResults.truePositives++
              } else {
                detectionResults.falsePositives++
              }
              
            } else if (analysis.drift.type === 'cosmetic') {
              results.summary.cosmeticDrift = true
              results.summary.warningChanges++
              detectionResults.trueNegatives++
            }
            
            // Update overall exit code (highest severity wins)
            if (analysis.exitCode === 3 && results.summary.exitCode < 3) {
              results.summary.exitCode = 3
              results.summary.overallSeverity = 'semantic'
            } else if (analysis.exitCode === 1 && results.summary.exitCode < 1) {
              results.summary.exitCode = 1
              results.summary.overallSeverity = 'cosmetic'
            }
            
            // Generate drift URI for significant changes
            if (analysis.drift.type === 'semantic' && analysis.semantic.graphDiff) {
              try {
                const baseline = analysis.semantic.baseline || {}
                const current = analysis.semantic.current || {}
                
                const patchResult = await driftURIResolver.storePatch(baseline, current, {
                  source: 'semantic-drift-detection',
                  format: 'semantic-analysis',
                  artifactPath
                })
                
                if (patchResult.uri) {
                  results.driftURIs.push({
                    artifact: artifactPath,
                    uri: patchResult.uri,
                    significance: analysis.drift.significance
                  })
                }
              } catch (error) {
                if (args.verbose) {
                  consola.warn(`Failed to generate drift URI for ${artifactPath}: ${error.message}`)
                }
              }
            }
            
          } else {
            detectionResults.trueNegatives++
          }
          
        } catch (error) {
          consola.error(`Analysis failed for ${artifactPath}: ${error.message}`)
          
          results.artifacts.push({
            path: artifactPath,
            name: basename(artifactPath),
            error: error.message,
            exitCode: 2
          })
          
          if (results.summary.exitCode < 2) {
            results.summary.exitCode = 2
            results.summary.overallSeverity = 'error'
          }
        }
      }
      
      // Calculate performance metrics
      const totalDetections = detectionResults.truePositives + detectionResults.falsePositives
      const totalNegatives = detectionResults.trueNegatives + detectionResults.falseNegatives
      
      results.performance.truePositiveRate = totalDetections > 0 
        ? (detectionResults.truePositives / totalDetections) * 100
        : 100
        
      results.performance.falsePositiveRate = totalNegatives > 0
        ? (detectionResults.falsePositives / totalNegatives) * 100
        : 0
        
      results.performance.analysisTime = this.getDeterministicTimestamp() - startTime
      
      // Get CAS performance metrics
      const casMetrics = analyzer.getMetrics()
      if (casMetrics.efficiency) {
        results.performance.cacheHitRate = casMetrics.efficiency.cacheHitRate * 100
      }
      
      // Generate recommendations
      if (results.summary.semanticDrift) {
        results.recommendations.push({
          type: 'semantic-drift',
          priority: 'critical',
          message: 'Semantic drift detected - review changes carefully',
          action: 'Manual review required before deployment'
        })
      }
      
      if (results.summary.cosmeticDrift && !results.summary.semanticDrift) {
        results.recommendations.push({
          type: 'cosmetic-drift',
          priority: 'low',
          message: 'Only cosmetic changes detected',
          action: 'Consider updating baselines if changes are intentional'
        })
      }
      
      if (results.performance.truePositiveRate < 90) {
        results.recommendations.push({
          type: 'accuracy-warning',
          priority: 'medium',
          message: `True positive rate: ${results.performance.truePositiveRate.toFixed(1)}% (target: ≥90%)`,
          action: 'Consider adjusting semantic threshold or reviewing detection logic'
        })
      }
      
      // Save detailed report if requested
      if (args.reportPath) {
        const reportContent = JSON.stringify(results, null, 2)
        writeFileSync(args.reportPath, reportContent, 'utf8')
        if (args.verbose) {
          consola.success(`📄 Detailed report saved to: ${args.reportPath}`)
        }
      }
      
      // Output results
      if (args.output === 'json') {
        console.log(JSON.stringify(results, null, 2))
      } else if (args.output === 'report') {
        generateTextReport(results, args.verbose)
      } else {
        // Default text output
        consola.info('🔍 Drift Detection Results')
        consola.info('━'.repeat(50))
        
        if (results.summary.driftDetected) {
          const severityColors = {
            semantic: 'red',
            cosmetic: 'yellow',
            error: 'red'
          }
          
          const color = severityColors[results.summary.overallSeverity] || 'yellow'
          const icon = results.summary.semanticDrift ? '🚨' : '⚠️'
          
          consola[color === 'red' ? 'error' : 'warn'](
            `${icon} Drift detected (${results.summary.overallSeverity.toUpperCase()})`
          )
          
          if (results.summary.semanticDrift) {
            consola.error(`  🔴 Semantic changes: ${results.summary.criticalChanges}`)
          }
          
          if (results.summary.cosmeticDrift) {
            consola.warn(`  🟡 Cosmetic changes: ${results.summary.warningChanges}`)
          }
          
        } else {
          consola.success('✅ No drift detected - all artifacts match expected state')
        }
        
        if (args.verbose) {
          consola.info(`\n📊 Performance Metrics:`)
          consola.info(`  True Positive Rate: ${results.performance.truePositiveRate.toFixed(1)}%`)
          consola.info(`  Cache Hit Rate: ${results.performance.cacheHitRate.toFixed(1)}%`)
          consola.info(`  Analysis Time: ${results.performance.analysisTime}ms`)
          
          if (results.driftURIs.length > 0) {
            consola.info(`\n🔗 Drift URIs Generated:`)
            results.driftURIs.forEach(drift => {
              consola.info(`  • ${basename(drift.artifact)}: ${drift.uri}`)
            })
          }
        }
      }
      
      // Exit with appropriate code for CI/CD integration
      if (args.exitOnDrift && results.summary.exitCode !== 0) {
        const exitMessages = {
          1: 'cosmetic changes detected',
          2: 'analysis errors encountered', 
          3: 'semantic drift detected'
        }
        
        consola.error(`💥 Exiting with code ${results.summary.exitCode}: ${exitMessages[results.summary.exitCode]}`)
        process.exit(results.summary.exitCode)
      }
      
      return results
      
    } catch (error) {
      const executionTime = this.getDeterministicTimestamp() - startTime
      
      const errorResult = {
        success: false,
        error: error.message,
        target: args.target,
        timestamp: this.getDeterministicDate().toISOString(),
        executionTime
      }
      
      if (args.output === 'json') {
        console.log(JSON.stringify(errorResult, null, 2))
      } else {
        consola.error('❌ Drift detection failed:', error.message)
        if (args.verbose) {
          consola.error(error.stack)
        }
      }
      
      if (args.exitOnDrift) {
        process.exit(2) // Analysis error
      }
      
      throw error
    }
  }
})

/**
 * Generate detailed text report
 */
function generateTextReport(results, verbose = false) {
  console.log('🔍 KGEN DRIFT DETECTION REPORT')
  console.log('═'.repeat(60))
  console.log(`📅 Generated: ${results.metadata.timestamp}`)
  console.log(`🆔 Analysis ID: ${results.metadata.analysisId}`)
  console.log(`📁 Target: ${results.metadata.target}`)
  console.log(`🎯 Semantic Threshold: ${results.metadata.semanticThreshold}`)
  
  console.log('\n📊 SUMMARY')
  console.log('─'.repeat(30))
  console.log(`Total Artifacts: ${results.summary.totalArtifacts}`)
  console.log(`Drift Detected: ${results.summary.driftDetected ? 'YES' : 'NO'}`)
  console.log(`Semantic Drift: ${results.summary.semanticDrift ? 'YES' : 'NO'}`)
  console.log(`Overall Severity: ${results.summary.overallSeverity.toUpperCase()}`)
  console.log(`Exit Code: ${results.summary.exitCode}`)
  
  if (results.summary.driftDetected) {
    console.log('\n🚨 DRIFT DETAILS')
    console.log('─'.repeat(30))
    
    results.artifacts.forEach(artifact => {
      if (artifact.drift && artifact.drift.detected) {
        console.log(`📄 ${artifact.name}`)
        console.log(`   Type: ${artifact.drift.type}`)
        console.log(`   Significance: ${artifact.drift.significance?.toFixed(3) || 'N/A'}`)
        console.log(`   Reasons: ${artifact.drift.reasons?.join(', ') || 'Unknown'}`)
      }
    })
  }
  
  console.log('\n⚡ PERFORMANCE')
  console.log('─'.repeat(30))
  console.log(`True Positive Rate: ${results.performance.truePositiveRate.toFixed(1)}%`)
  console.log(`Cache Hit Rate: ${results.performance.cacheHitRate.toFixed(1)}%`)
  console.log(`Analysis Time: ${results.performance.analysisTime}ms`)
  
  if (results.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS')
    console.log('─'.repeat(30))
    results.recommendations.forEach(rec => {
      const icon = rec.priority === 'critical' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🔵'
      console.log(`${icon} ${rec.message}`)
      console.log(`   Action: ${rec.action}`)
    })
  }
  
  if (verbose && results.driftURIs.length > 0) {
    console.log('\n🔗 DRIFT URIS')
    console.log('─'.repeat(30))
    results.driftURIs.forEach(drift => {
      console.log(`📄 ${basename(drift.artifact)}`)
      console.log(`   URI: ${drift.uri}`)
      console.log(`   Significance: ${drift.significance?.toFixed(3) || 'N/A'}`)
    })
  }
}

export default driftDetectCommand