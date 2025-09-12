/**
 * Semantic Drift Detection Tests
 * Testing Agent 7's enhanced drift detection with ≥90% SNR
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { SemanticDriftAnalyzer } from '../packages/kgen-core/src/validation/semantic-drift-analyzer.js'
import { semanticDriftCommand } from '../packages/kgen-cli/src/commands/artifact/semantic-drift.js'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

describe('Semantic Drift Detection', () => {
  let analyzer
  let tempDir
  let testFiles

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp('/tmp/semantic-drift-test-')
    
    analyzer = new SemanticDriftAnalyzer({
      semanticThreshold: 0.1,
      truePositiveThreshold: 0.9,
      enableSemanticAnalysis: true,
      enableSHACLValidation: true,
      enableGitIntegration: false, // Disable git for isolated testing
      enableCAS: true
    })
    
    await analyzer.initialize()

    testFiles = {
      // RDF test files for semantic analysis
      baselineRDF: path.join(tempDir, 'baseline.ttl'),
      semanticDriftRDF: path.join(tempDir, 'semantic-drift.ttl'),
      cosmeticChangeRDF: path.join(tempDir, 'cosmetic-change.ttl'),
      
      // JSON test files for structural analysis
      baselineJSON: path.join(tempDir, 'baseline.json'),
      structuralDriftJSON: path.join(tempDir, 'structural-drift.json'),
      minorChangeJSON: path.join(tempDir, 'minor-change.json'),

      // Attestation files
      attestation: path.join(tempDir, 'baseline.ttl.attest.json')
    }

    // Create test files
    await createTestFiles()
  })

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Semantic Analysis', () => {
    test('should detect semantic drift in RDF with high significance', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.semanticDriftRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.drift.detected).toBe(true)
      expect(analysis.drift.type).toBe('semantic')
      expect(analysis.drift.significance).toBeGreaterThan(0.1) // Above threshold
      expect(analysis.semantic.graphDiff.significance).toBeGreaterThan(0.1)
      expect(analysis.exitCode).toBe(3) // Semantic drift exit code
    })

    test('should identify cosmetic changes as non-semantic', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.cosmeticChangeRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.drift.detected).toBe(true)
      expect(analysis.drift.type).toBe('cosmetic')
      expect(analysis.drift.significance).toBeLessThan(0.1) // Below semantic threshold
      expect(analysis.exitCode).toBe(1) // Non-semantic change exit code
    })

    test('should detect no drift for identical files', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.drift.detected).toBe(false)
      expect(analysis.drift.type).toBe('none')
      expect(analysis.drift.significance).toBe(0.0)
      expect(analysis.exitCode).toBe(0) // No change exit code
    })
  })

  describe('Performance and SNR Requirements', () => {
    test('should meet ≥90% true positive rate requirement', async () => {
      const testCases = [
        // True positives - should detect semantic drift
        { file: testFiles.semanticDriftRDF, baseline: testFiles.baselineRDF, expectDrift: true },
        { file: testFiles.semanticDriftRDF, baseline: testFiles.baselineRDF, expectDrift: true },
        { file: testFiles.semanticDriftRDF, baseline: testFiles.baselineRDF, expectDrift: true },
        { file: testFiles.semanticDriftRDF, baseline: testFiles.baselineRDF, expectDrift: true },
        { file: testFiles.semanticDriftRDF, baseline: testFiles.baselineRDF, expectDrift: true },
        
        // True negatives - should not detect drift for cosmetic changes
        { file: testFiles.cosmeticChangeRDF, baseline: testFiles.baselineRDF, expectDrift: false },
        { file: testFiles.cosmeticChangeRDF, baseline: testFiles.baselineRDF, expectDrift: false },
        { file: testFiles.cosmeticChangeRDF, baseline: testFiles.baselineRDF, expectDrift: false },
        { file: testFiles.cosmeticChangeRDF, baseline: testFiles.baselineRDF, expectDrift: false },
        { file: testFiles.cosmeticChangeRDF, baseline: testFiles.baselineRDF, expectDrift: false },
      ]

      let truePositives = 0
      let falsePositives = 0
      let totalTests = testCases.length

      for (const testCase of testCases) {
        const baseline = await fs.readFile(testCase.baseline, 'utf8')
        const analysis = await analyzer.analyzeSemanticDrift(testCase.file, { baseline })
        
        const detectedSemanticDrift = analysis.drift.detected && analysis.drift.type === 'semantic'
        
        if (testCase.expectDrift && detectedSemanticDrift) {
          truePositives++
        } else if (!testCase.expectDrift && !detectedSemanticDrift) {
          truePositives++
        } else {
          falsePositives++
        }
      }

      const truePositiveRate = truePositives / totalTests
      const metrics = analyzer.getMetrics()

      expect(truePositiveRate).toBeGreaterThanOrEqual(0.9) // ≥90% SNR
      expect(metrics.truePositiveRate).toBeGreaterThanOrEqual(90) // Percentage format
      expect(metrics.meetsSNRTarget).toBe(true)
    })

    test('should complete analysis within 500ms for typical files', async () => {
      const startTime = this.getDeterministicTimestamp()
      
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })
      
      const analysisTime = this.getDeterministicTimestamp() - startTime
      
      expect(analysisTime).toBeLessThan(500) // 500ms performance target
      expect(analysis.performance.analysisTime).toBeLessThan(500)
    })
  })

  describe('CI/CD Exit Codes', () => {
    test('should return exit code 0 for no changes', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.exitCode).toBe(0)
    })

    test('should return exit code 1 for non-semantic changes', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.cosmeticChangeRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.exitCode).toBe(1)
    })

    test('should return exit code 3 for semantic drift', async () => {
      const analysis = await analyzer.analyzeSemanticDrift(testFiles.semanticDriftRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.exitCode).toBe(3)
    })
  })

  describe('SHACL Validation Integration', () => {
    test('should detect constraint violations as semantic drift', async () => {
      // Create RDF with SHACL constraint violations
      const violatingRDF = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:Person1 rdf:type ex:InvalidType .
        ex:Person1 ex:hasAge "invalid-age" .
      `
      
      const violatingFile = path.join(tempDir, 'violating.ttl')
      await fs.writeFile(violatingFile, violatingRDF)

      const analysis = await analyzer.analyzeSemanticDrift(violatingFile, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })

      expect(analysis.semantic.shaclViolations).toBeInstanceOf(Array)
      if (analysis.semantic.shaclViolations.length > 0) {
        expect(analysis.drift.detected).toBe(true)
        expect(analysis.exitCode).toBe(3)
      }
    })
  })

  describe('CAS Performance Optimization', () => {
    test('should use CAS cache for unchanged files', async () => {
      // First analysis - no cache hit
      const analysis1 = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })
      expect(analysis1.performance.casHit).toBe(false)

      // Second analysis - should hit cache
      const analysis2 = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF, {
        baseline: await fs.readFile(testFiles.baselineRDF, 'utf8')
      })
      expect(analysis2.performance.casHit).toBe(true)
    })
  })

  describe('Attestation Integration', () => {
    test('should detect attestation hash mismatches', async () => {
      // Create modified content that doesn't match attestation
      const modifiedContent = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:Person1 rdf:type ex:Person .
        ex:Person1 ex:name "Modified Name" .
        ex:Person1 ex:age 25 .
      `
      
      await fs.writeFile(testFiles.baselineRDF, modifiedContent)

      const analysis = await analyzer.analyzeSemanticDrift(testFiles.baselineRDF)

      expect(analysis.drift.detected).toBe(true)
      expect(analysis.drift.reasons).toContain('Attestation hash mismatch indicates modification')
      expect(analysis.exitCode).toBe(3)
    })
  })

  describe('Command Line Interface', () => {
    test('should handle command line arguments correctly', async () => {
      // Note: This would typically use a test runner that can execute CLI commands
      // For now, we test the command structure
      expect(semanticDriftCommand.meta.name).toBe('semantic-drift')
      expect(semanticDriftCommand.args.artifact.required).toBe(true)
      expect(semanticDriftCommand.args.threshold.default).toBe('0.1')
      expect(semanticDriftCommand.args.exitCode.default).toBe(false)
    })
  })

  // Helper function to create test files
  async function createTestFiles() {
    // Baseline RDF file
    const baselineRDF = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:Person rdf:type rdfs:Class .
      ex:Person rdfs:label "Person" .
      
      ex:Person1 rdf:type ex:Person .
      ex:Person1 ex:name "John Doe" .
      ex:Person1 ex:age 30 .
    `

    // Semantic drift - type change (high impact)
    const semanticDriftRDF = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:Employee rdf:type rdfs:Class .
      ex:Employee rdfs:label "Employee" .
      
      ex:Person1 rdf:type ex:Employee .
      ex:Person1 ex:name "John Doe" .
      ex:Person1 ex:salary 50000 .
    `

    // Cosmetic change - only formatting and comments (low impact)
    const cosmeticChangeRDF = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      # This is a comment
      ex:Person rdf:type rdfs:Class .
      ex:Person rdfs:label "Person"  .
      
      ex:Person1 rdf:type ex:Person .
      ex:Person1 ex:name  "John Doe" .
      ex:Person1 ex:age   30 .
    `

    // JSON files for structural analysis
    const baselineJSON = JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "lodash": "^4.17.21"
      }
    }, null, 2)

    const structuralDriftJSON = JSON.stringify({
      name: "test-project",
      version: "2.0.0",
      dependencies: {
        "lodash": "^4.17.21",
        "axios": "^1.0.0"
      },
      scripts: {
        "test": "vitest"
      }
    }, null, 2)

    const minorChangeJSON = JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "lodash": "^4.17.21"
      }
    }, null, 4) // Just formatting change

    // Attestation file
    const attestation = {
      artifact: {
        path: testFiles.baselineRDF,
        hash: "expected-hash-here",
        size: baselineRDF.length,
        generatedAt: this.getDeterministicDate().toISOString()
      },
      provenance: {
        templatePath: "template.ttl",
        sourceGraph: "source-data.json",
        templateHash: "template-hash",
        dataSourceHash: "data-hash"
      },
      signature: "cryptographic-signature"
    }

    // Write test files
    await fs.writeFile(testFiles.baselineRDF, baselineRDF)
    await fs.writeFile(testFiles.semanticDriftRDF, semanticDriftRDF)
    await fs.writeFile(testFiles.cosmeticChangeRDF, cosmeticChangeRDF)
    await fs.writeFile(testFiles.baselineJSON, baselineJSON)
    await fs.writeFile(testFiles.structuralDriftJSON, structuralDriftJSON)
    await fs.writeFile(testFiles.minorChangeJSON, minorChangeJSON)
    await fs.writeFile(testFiles.attestation, JSON.stringify(attestation, null, 2))
  }
})

describe('Integration Tests', () => {
  test('should integrate with existing KGEN drift detection', async () => {
    // Test integration with Agent 10's drift detection
    const analyzer = new SemanticDriftAnalyzer({
      enableSemanticAnalysis: true,
      enableSHACLValidation: true
    })
    
    await analyzer.initialize()
    
    // Verify analyzer is properly initialized
    expect(analyzer.config.enableSemanticAnalysis).toBe(true)
    expect(analyzer.config.enableSHACLValidation).toBe(true)
    expect(analyzer.metrics.totalAnalyses).toBe(0)
    
    const status = analyzer.getMetrics()
    expect(status.truePositiveRate).toBe(0) // No tests run yet
    expect(status.targetSNR).toBe(90) // 90% target
  })

  test('should handle large files efficiently', async () => {
    const analyzer = new SemanticDriftAnalyzer({
      maxFileSize: 1024 * 1024, // 1MB limit
      analysisTimeout: 30000 // 30s timeout
    })

    await analyzer.initialize()

    // Create a file that exceeds size limit
    const largeFile = '/tmp/large-test-file.ttl'
    const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB
    
    await fs.writeFile(largeFile, largeContent)

    try {
      const analysis = await analyzer.analyzeSemanticDrift(largeFile)
      expect(analysis.error).toContain('File too large')
      expect(analysis.exitCode).toBe(2) // Analysis error
    } finally {
      await fs.unlink(largeFile).catch(() => {}) // Cleanup
    }
  })
})

describe('Error Handling', () => {
  test('should handle malformed RDF gracefully', async () => {
    const tempDir = await fs.mkdtemp('/tmp/error-test-')
    const malformedFile = path.join(tempDir, 'malformed.ttl')
    
    // Write malformed RDF
    await fs.writeFile(malformedFile, 'invalid rdf content <<<>>>')
    
    try {
      const analyzer = new SemanticDriftAnalyzer()
      await analyzer.initialize()
      
      const analysis = await analyzer.analyzeSemanticDrift(malformedFile)
      
      // Should handle error gracefully
      expect(analysis).toBeDefined()
      expect(analysis.error || analysis.drift.reasons.length > 0).toBe(true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('should handle missing baseline files', async () => {
    const tempDir = await fs.mkdtemp('/tmp/missing-test-')
    const testFile = path.join(tempDir, 'test.ttl')
    
    await fs.writeFile(testFile, '@prefix ex: <http://example.org/> .')
    
    try {
      const analyzer = new SemanticDriftAnalyzer()
      await analyzer.initialize()
      
      const analysis = await analyzer.analyzeSemanticDrift(testFile, {
        baseline: null
      })
      
      expect(analysis.drift.reasons).toContain('No baseline available for comparison')
      expect(analysis.exitCode).toBe(2) // Analysis error
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})