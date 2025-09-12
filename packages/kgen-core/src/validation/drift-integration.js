/**
 * Drift Detection Integration Module
 * 
 * Integrates Agent 7's Semantic Drift Analyzer with existing KGEN components:
 * - Agent 4's SHACL validation
 * - Agent 2's git-first workflow  
 * - Agent 3's CAS optimization
 * - Agent 10's traditional drift detection
 */

import { SemanticDriftAnalyzer } from './semantic-drift-analyzer.js'
import { DriftHelperMethods } from './drift-helpers.js'
import { EnhancedRDFProcessor } from '../rdf/enhanced-processor.js'
import { SemanticProcessor } from '../semantic/processor.js'
import { DriftURIResolver, driftURIResolver } from '../../../src/kgen/drift/drift-uri-resolver.js'
import { driftDetector } from '../../../src/kgen/drift/drift-detector.js'
import { consola } from 'consola'
import path from 'path'
import fs from 'fs/promises'

export class IntegratedDriftDetector {
  constructor(config = {}) {
    this.config = {
      // Feature toggles for different analysis types
      enableSemanticAnalysis: config.enableSemanticAnalysis !== false,
      enableTraditionalDrift: config.enableTraditionalDrift !== false,
      enableSHACLValidation: config.enableSHACLValidation !== false,
      enableRDFProcessing: config.enableRDFProcessing !== false,
      enableDriftURIs: config.enableDriftURIs !== false,
      
      // Performance options
      enableCAS: config.enableCAS !== false,
      enableGitIntegration: config.enableGitIntegration !== false,
      parallelAnalysis: config.parallelAnalysis !== false,
      
      // Thresholds and targets
      semanticThreshold: config.semanticThreshold || 0.1,
      truePositiveTarget: config.truePositiveTarget || 0.9,
      analysisTimeout: config.analysisTimeout || 30000,
      
      ...config
    }

    this.logger = consola.withTag('integrated-drift')
    this.components = {}
    this.metrics = {
      totalAnalyses: 0,
      semanticAnalyses: 0,
      traditionalAnalyses: 0,
      combinedAccuracy: 0,
      averageTime: 0
    }
  }

  /**
   * Initialize all integrated components
   */
  async initialize() {
    try {
      this.logger.info('Initializing Integrated Drift Detector...')

      // Initialize semantic drift analyzer (Agent 7)
      if (this.config.enableSemanticAnalysis) {
        this.components.semanticAnalyzer = new SemanticDriftAnalyzer({
          semanticThreshold: this.config.semanticThreshold,
          truePositiveThreshold: this.config.truePositiveTarget,
          enableSHACLValidation: this.config.enableSHACLValidation,
          enableGitIntegration: this.config.enableGitIntegration,
          enableCAS: this.config.enableCAS
        })
        await this.components.semanticAnalyzer.initialize()
        this.logger.success('Semantic drift analyzer initialized')
      }

      // Initialize RDF processor (Agent enhancements)
      if (this.config.enableRDFProcessing) {
        this.components.rdfProcessor = new EnhancedRDFProcessor({
          enableCanonicalization: true,
          enableIndexing: true,
          enableValidation: this.config.enableSHACLValidation,
          cacheResults: this.config.enableCAS
        })
        await this.components.rdfProcessor.initialize()
        this.logger.success('Enhanced RDF processor initialized')
      }

      // Initialize semantic processor (Agent 4 integration)
      if (this.config.enableSHACLValidation) {
        this.components.semanticProcessor = new SemanticProcessor({
          enableSHACLValidation: true,
          enableOWLReasoning: false, // Keep lightweight for drift detection
          reasoningTimeout: 10000
        })
        await this.components.semanticProcessor.initialize()
        this.logger.success('Semantic processor initialized')
      }

      // Initialize drift URI resolver (Dark Matter integration)
      if (this.config.enableDriftURIs) {
        this.components.driftURIResolver = driftURIResolver
        await this.components.driftURIResolver.initializeStorage()
        this.logger.success('Drift URI resolver initialized')
      }

      // Initialize CAS drift detector
      if (this.config.enableCAS) {
        this.components.driftDetector = driftDetector
        this.logger.success('CAS drift detector integrated')
      }

      // Mix in traditional drift helpers (Agent 10)
      if (this.config.enableTraditionalDrift) {
        Object.assign(this, DriftHelperMethods)
        this.logger.success('Traditional drift detection methods integrated')
      }

      this.logger.success('Integrated Drift Detector initialized')
      return { status: 'success', components: Object.keys(this.components) }
    } catch (error) {
      this.logger.error('Failed to initialize Integrated Drift Detector:', error)
      throw error
    }
  }

  /**
   * Perform comprehensive drift analysis using all available methods
   */
  async analyzeDrift(artifactPath, options = {}) {
    const startTime = this.getDeterministicTimestamp()
    this.metrics.totalAnalyses++

    try {
      const analysis = {
        artifact: {
          path: artifactPath,
          name: path.basename(artifactPath)
        },
        results: {
          semantic: null,
          traditional: null,
          rdf: null,
          shacl: null,
          driftURI: null,
          cas: null
        },
        summary: {
          driftDetected: false,
          driftType: 'none',
          confidence: 0.0,
          significance: 0.0,
          exitCode: 0
        },
        integration: {
          componentsUsed: [],
          consensusReached: false,
          conflictingResults: false
        },
        performance: {
          totalTime: 0,
          parallelExecution: this.config.parallelAnalysis
        },
        timestamp: this.getDeterministicDate().toISOString()
      }

      // Determine analysis strategy based on file type and available components
      const fileFormat = this.detectFileFormat(artifactPath)
      const analysisStrategy = this.planAnalysisStrategy(fileFormat, options)
      
      if (this.config.parallelAnalysis) {
        // Parallel analysis for better performance
        await this.performParallelAnalysis(artifactPath, analysis, analysisStrategy, options)
      } else {
        // Sequential analysis for better resource management
        await this.performSequentialAnalysis(artifactPath, analysis, analysisStrategy, options)
      }

      // Synthesize results from multiple components
      this.synthesizeResults(analysis)

      // Apply consensus algorithm
      this.applyConsensus(analysis)

      // Update metrics
      analysis.performance.totalTime = this.getDeterministicTimestamp() - startTime
      this.updateMetrics(analysis)

      this.logger.info(`Drift analysis completed: ${analysis.summary.driftType} (${analysis.performance.totalTime}ms)`)
      
      return analysis

    } catch (error) {
      this.logger.error(`Integrated drift analysis failed for ${artifactPath}:`, error)
      return {
        artifact: { path: artifactPath, name: path.basename(artifactPath) },
        error: error.message,
        summary: { exitCode: 2, driftType: 'error' },
        timestamp: this.getDeterministicDate().toISOString()
      }
    }
  }

  /**
   * Perform parallel analysis using all available components
   */
  async performParallelAnalysis(artifactPath, analysis, strategy, options) {
    const analysisPromises = []

    // Semantic analysis (Agent 7)
    if (strategy.semantic && this.components.semanticAnalyzer) {
      analysisPromises.push(
        this.components.semanticAnalyzer.analyzeSemanticDrift(artifactPath, options)
          .then(result => ({ type: 'semantic', result }))
          .catch(error => ({ type: 'semantic', error }))
      )
      analysis.integration.componentsUsed.push('semantic')
    }

    // RDF processing analysis  
    if (strategy.rdf && this.components.rdfProcessor) {
      analysisPromises.push(
        this.performRDFAnalysis(artifactPath, options)
          .then(result => ({ type: 'rdf', result }))
          .catch(error => ({ type: 'rdf', error }))
      )
      analysis.integration.componentsUsed.push('rdf')
    }

    // Traditional drift analysis (Agent 10)
    if (strategy.traditional && this.config.enableTraditionalDrift) {
      analysisPromises.push(
        this.performTraditionalAnalysis(artifactPath, options)
          .then(result => ({ type: 'traditional', result }))
          .catch(error => ({ type: 'traditional', error }))
      )
      analysis.integration.componentsUsed.push('traditional')
    }

    // SHACL validation analysis
    if (strategy.shacl && this.components.semanticProcessor) {
      analysisPromises.push(
        this.performSHACLAnalysis(artifactPath, options)
          .then(result => ({ type: 'shacl', result }))
          .catch(error => ({ type: 'shacl', error }))
      )
      analysis.integration.componentsUsed.push('shacl')
    }

    // Drift URI analysis and patch generation
    if (strategy.driftURI && this.components.driftURIResolver) {
      analysisPromises.push(
        this.performDriftURIAnalysis(artifactPath, options)
          .then(result => ({ type: 'driftURI', result }))
          .catch(error => ({ type: 'driftURI', error }))
      )
      analysis.integration.componentsUsed.push('driftURI')
    }

    // CAS drift detection
    if (strategy.cas && this.components.driftDetector) {
      analysisPromises.push(
        this.performCASAnalysis(artifactPath, options)
          .then(result => ({ type: 'cas', result }))
          .catch(error => ({ type: 'cas', error }))
      )
      analysis.integration.componentsUsed.push('cas')
    }

    // Wait for all analyses to complete
    const results = await Promise.allSettled(analysisPromises)
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { type, result: analysisResult, error } = result.value
        if (error) {
          analysis.results[type] = { error: error.message }
        } else {
          analysis.results[type] = analysisResult
        }
      }
    }
  }

  /**
   * Perform sequential analysis for resource-constrained environments
   */
  async performSequentialAnalysis(artifactPath, analysis, strategy, options) {
    // Semantic analysis first (highest precision)
    if (strategy.semantic && this.components.semanticAnalyzer) {
      try {
        analysis.results.semantic = await this.components.semanticAnalyzer.analyzeSemanticDrift(artifactPath, options)
        analysis.integration.componentsUsed.push('semantic')
        this.metrics.semanticAnalyses++
      } catch (error) {
        analysis.results.semantic = { error: error.message }
      }
    }

    // RDF processing analysis
    if (strategy.rdf && this.components.rdfProcessor) {
      try {
        analysis.results.rdf = await this.performRDFAnalysis(artifactPath, options)
        analysis.integration.componentsUsed.push('rdf')
      } catch (error) {
        analysis.results.rdf = { error: error.message }
      }
    }

    // Traditional drift analysis (fallback)
    if (strategy.traditional && this.config.enableTraditionalDrift) {
      try {
        analysis.results.traditional = await this.performTraditionalAnalysis(artifactPath, options)
        analysis.integration.componentsUsed.push('traditional')
        this.metrics.traditionalAnalyses++
      } catch (error) {
        analysis.results.traditional = { error: error.message }
      }
    }

    // SHACL validation
    if (strategy.shacl && this.components.semanticProcessor) {
      try {
        analysis.results.shacl = await this.performSHACLAnalysis(artifactPath, options)
        analysis.integration.componentsUsed.push('shacl')
      } catch (error) {
        analysis.results.shacl = { error: error.message }
      }
    }
  }

  /**
   * Perform RDF-specific analysis
   */
  async performRDFAnalysis(artifactPath, options) {
    const startTime = this.getDeterministicTimestamp()

    // Use enhanced RDF processor for graph comparison
    if (options.baseline) {
      const tempBaselineFile = '/tmp/baseline-' + this.getDeterministicTimestamp() + '.ttl'
      await fs.writeFile(tempBaselineFile, options.baseline)

      try {
        const diffResult = await this.components.rdfProcessor.graphDiff(
          tempBaselineFile,
          artifactPath,
          {
            checkSemanticEquivalence: true,
            includeChanges: true,
            maxChanges: 50
          }
        )

        return {
          identical: diffResult.identical,
          semanticallyEquivalent: diffResult.semanticallyEquivalent,
          differences: diffResult.differences,
          summary: diffResult.summary,
          analysisTime: this.getDeterministicTimestamp() - startTime
        }
      } finally {
        await fs.unlink(tempBaselineFile).catch(() => {})
      }
    }

    // Fallback to hash analysis
    const hashResult = await this.components.rdfProcessor.graphHash(artifactPath)
    return {
      hash: hashResult.hash,
      canonicalHash: hashResult.canonicalHash,
      contentHash: hashResult.contentHash,
      analysisTime: this.getDeterministicTimestamp() - startTime
    }
  }

  /**
   * Perform traditional drift analysis using Agent 10's methods
   */
  async performTraditionalAnalysis(artifactPath, options) {
    const startTime = this.getDeterministicTimestamp()

    try {
      // Load current and baseline content
      const currentContent = await fs.readFile(artifactPath, 'utf8')
      let baselineContent = options.baseline

      if (!baselineContent) {
        // Try to load from attestation
        const attestationPath = `${artifactPath}.attest.json`
        try {
          const attestationData = JSON.parse(await fs.readFile(attestationPath, 'utf8'))
          baselineContent = attestationData.baseline?.content
        } catch {}
      }

      if (!baselineContent) {
        return { error: 'No baseline available for traditional analysis' }
      }

      // Use drift helper methods
      const similarity = this.calculateSimilarityScore(currentContent, baselineContent)
      const differences = await this.analyzeDifferences(currentContent, baselineContent, artifactPath)
      const consistency = await this.checkStateConsistency(artifactPath, currentContent)

      return {
        similarity,
        differences,
        consistency,
        driftDetected: similarity < 0.95, // 95% similarity threshold
        analysisTime: this.getDeterministicTimestamp() - startTime
      }
    } catch (error) {
      return { error: error.message, analysisTime: this.getDeterministicTimestamp() - startTime }
    }
  }

  /**
   * Perform drift URI analysis with semantic patch generation
   */
  async performDriftURIAnalysis(artifactPath, options) {
    const startTime = this.getDeterministicTimestamp()

    try {
      const currentContent = await fs.readFile(artifactPath, 'utf8')
      let baselineContent = options.baseline

      if (!baselineContent) {
        // Try to load from attestation
        const attestationPath = `${artifactPath}.attest.json`
        try {
          const attestationData = JSON.parse(await fs.readFile(attestationPath, 'utf8'))
          baselineContent = attestationData.baseline?.content
        } catch {}
      }

      if (!baselineContent) {
        return { error: 'No baseline available for drift URI analysis' }
      }

      // Parse content as JSON for patch generation
      let baselineData, currentData
      try {
        baselineData = JSON.parse(baselineContent)
        currentData = JSON.parse(currentContent)
      } catch (error) {
        // Fallback to text-based analysis
        baselineData = { content: baselineContent }
        currentData = { content: currentContent }
      }

      // Generate semantic patch with drift URI
      const patchResult = await this.components.driftURIResolver.storePatch(
        baselineData, 
        currentData,
        {
          source: `drift-analysis:${path.basename(artifactPath)}`,
          format: this.detectFileFormat(artifactPath)
        }
      )

      // If patch was generated, provide additional analysis
      let reversePatch = null
      if (patchResult.uri) {
        const reverseResult = await this.components.driftURIResolver.generateReversePatch(
          baselineData,
          currentData
        )
        reversePatch = reverseResult
      }

      return {
        driftURI: patchResult.uri,
        patch: patchResult.patch,
        metadata: patchResult.metadata,
        reversePatch,
        identical: !patchResult.patch,
        semanticSignificance: patchResult.metadata?.semantic?.significance || 0,
        analysisTime: this.getDeterministicTimestamp() - startTime
      }

    } catch (error) {
      return { error: error.message, analysisTime: this.getDeterministicTimestamp() - startTime }
    }
  }

  /**
   * Perform CAS-based drift detection
   */
  async performCASAnalysis(artifactPath, options) {
    const startTime = this.getDeterministicTimestamp()

    try {
      // Create baseline if needed
      const baselineResult = await this.components.driftDetector.createBaseline(artifactPath)
      
      // Detect drift
      const driftResult = await this.components.driftDetector.detectDrift(artifactPath, options)
      
      return {
        hasDrift: driftResult.hasDrift,
        driftTypes: driftResult.driftTypes,
        baseline: driftResult.baseline,
        current: driftResult.current,
        details: driftResult.details,
        cid: baselineResult.cid,
        analysisTime: this.getDeterministicTimestamp() - startTime
      }

    } catch (error) {
      return { error: error.message, analysisTime: this.getDeterministicTimestamp() - startTime }
    }
  }

  /**
   * Perform SHACL constraint validation
   */
  async performSHACLAnalysis(artifactPath, options) {
    const startTime = this.getDeterministicTimestamp()

    try {
      const content = await fs.readFile(artifactPath, 'utf8')
      
      // Create a minimal graph for validation
      const graph = {
        entities: [],
        relationships: [],
        triples: content.split('\n').filter(line => 
          line.trim() && 
          !line.trim().startsWith('#') && 
          !line.trim().startsWith('@')
        )
      }

      const validationResult = await this.components.semanticProcessor.validateGraph(
        graph,
        [], // Constraints would be loaded from SHACL shapes
        { includeWarnings: true }
      )

      return {
        valid: validationResult.isValid,
        violations: validationResult.violations,
        warnings: validationResult.warnings,
        constraintsChecked: validationResult.statistics.constraintsChecked,
        analysisTime: this.getDeterministicTimestamp() - startTime
      }
    } catch (error) {
      return { error: error.message, analysisTime: this.getDeterministicTimestamp() - startTime }
    }
  }

  /**
   * Synthesize results from multiple analysis components
   */
  synthesizeResults(analysis) {
    const results = analysis.results
    let driftDetected = false
    let driftType = 'none'
    let significance = 0.0
    let confidence = 0.0

    // Weight results based on component reliability and file type
    const weights = {
      semantic: 0.4,    // Highest weight for semantic analysis
      rdf: 0.3,         // High weight for RDF-specific analysis
      traditional: 0.2, // Medium weight for traditional analysis
      shacl: 0.1        // Lower weight for constraint validation
    }

    let totalWeight = 0
    let weightedSignificance = 0

    // Process semantic analysis results
    if (results.semantic && !results.semantic.error) {
      const weight = weights.semantic
      totalWeight += weight
      
      if (results.semantic.drift.detected) {
        driftDetected = true
        if (results.semantic.drift.type === 'semantic') {
          driftType = 'semantic'
          significance = Math.max(significance, results.semantic.drift.significance)
        } else if (driftType === 'none') {
          driftType = results.semantic.drift.type
        }
      }
      
      weightedSignificance += weight * (results.semantic.drift.significance || 0)
    }

    // Process RDF analysis results
    if (results.rdf && !results.rdf.error) {
      const weight = weights.rdf
      totalWeight += weight
      
      if (results.rdf.differences > 0 || !results.rdf.identical) {
        driftDetected = true
        if (driftType === 'none') {
          driftType = results.rdf.semanticallyEquivalent ? 'cosmetic' : 'structural'
        }
      }
    }

    // Process traditional analysis results
    if (results.traditional && !results.traditional.error) {
      const weight = weights.traditional
      totalWeight += weight
      
      if (results.traditional.driftDetected) {
        driftDetected = true
        if (driftType === 'none') {
          driftType = 'traditional'
        }
      }
      
      const traditionalSignificance = 1.0 - (results.traditional.similarity || 1.0)
      weightedSignificance += weight * traditionalSignificance
    }

    // Process SHACL validation results
    if (results.shacl && !results.shacl.error) {
      const weight = weights.shacl
      totalWeight += weight
      
      if (results.shacl.violations && results.shacl.violations.length > 0) {
        driftDetected = true
        driftType = 'semantic' // SHACL violations are semantic issues
      }
    }

    // Calculate final confidence and significance
    if (totalWeight > 0) {
      confidence = totalWeight / Object.values(weights).reduce((sum, w) => sum + w, 0)
      significance = weightedSignificance / totalWeight
    }

    // Determine exit code
    let exitCode = 0
    if (driftDetected) {
      if (driftType === 'semantic' || significance > this.config.semanticThreshold) {
        exitCode = 3 // Semantic drift
      } else {
        exitCode = 1 // Non-semantic changes
      }
    }

    // Update analysis summary
    analysis.summary = {
      driftDetected,
      driftType,
      confidence: Math.round(confidence * 100) / 100,
      significance: Math.round(significance * 1000) / 1000,
      exitCode
    }
  }

  /**
   * Apply consensus algorithm to resolve conflicting results
   */
  applyConsensus(analysis) {
    const results = analysis.results
    const validResults = Object.values(results).filter(r => r && !r.error)
    
    if (validResults.length < 2) {
      analysis.integration.consensusReached = true
      return
    }

    // Check for conflicting drift detection results
    const driftDetections = validResults.map(r => {
      if (r.drift?.detected) return r.drift.detected
      if (r.driftDetected) return r.driftDetected
      if (r.differences > 0) return true
      if (r.violations?.length > 0) return true
      return false
    })

    const uniqueDetections = [...new Set(driftDetections)]
    analysis.integration.conflictingResults = uniqueDetections.length > 1

    // If there's conflict, favor the more sensitive analysis
    if (analysis.integration.conflictingResults) {
      // Semantic analysis takes precedence
      if (results.semantic && results.semantic.drift?.detected) {
        analysis.summary.driftDetected = true
        analysis.summary.driftType = results.semantic.drift.type
      }
    }

    analysis.integration.consensusReached = !analysis.integration.conflictingResults
  }

  /**
   * Plan analysis strategy based on file type and options
   */
  planAnalysisStrategy(fileFormat, options) {
    const strategy = {
      semantic: false,
      rdf: false,
      traditional: false,
      shacl: false,
      driftURI: false,
      cas: false
    }

    // RDF files benefit from semantic and RDF-specific analysis
    if (['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld'].includes(fileFormat)) {
      strategy.semantic = this.config.enableSemanticAnalysis
      strategy.rdf = this.config.enableRDFProcessing
      strategy.shacl = this.config.enableSHACLValidation
      strategy.driftURI = this.config.enableDriftURIs
      strategy.cas = this.config.enableCAS
    } else {
      // Non-RDF files use traditional analysis
      strategy.traditional = this.config.enableTraditionalDrift
      strategy.semantic = this.config.enableSemanticAnalysis // Still useful for structured formats
      strategy.driftURI = this.config.enableDriftURIs
      strategy.cas = this.config.enableCAS
    }

    return strategy
  }

  /**
   * Detect file format from extension
   */
  detectFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const formatMap = {
      '.ttl': 'turtle',
      '.turtle': 'turtle',
      '.n3': 'n3', 
      '.nt': 'ntriples',
      '.rdf': 'rdfxml',
      '.jsonld': 'jsonld',
      '.json': 'json',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python'
    }
    return formatMap[ext] || 'text'
  }

  /**
   * Update performance metrics
   */
  updateMetrics(analysis) {
    const { totalTime } = analysis.performance
    this.metrics.averageTime = 
      (this.metrics.averageTime * (this.metrics.totalAnalyses - 1) + totalTime) / 
      this.metrics.totalAnalyses

    // Update accuracy based on consensus
    if (analysis.integration.consensusReached && analysis.integration.componentsUsed.length > 1) {
      // Increase combined accuracy score
      this.metrics.combinedAccuracy = Math.min(
        this.metrics.combinedAccuracy + 0.1, 
        1.0
      )
    }
  }

  /**
   * Get comprehensive metrics from all components
   */
  getMetrics() {
    const componentMetrics = {}

    if (this.components.semanticAnalyzer) {
      componentMetrics.semantic = this.components.semanticAnalyzer.getMetrics()
    }

    if (this.components.rdfProcessor) {
      componentMetrics.rdf = this.components.rdfProcessor.getStatus()
    }

    return {
      integrated: this.metrics,
      components: componentMetrics,
      config: {
        semanticThreshold: this.config.semanticThreshold,
        truePositiveTarget: this.config.truePositiveTarget,
        enabledComponents: Object.keys(this.components)
      }
    }
  }

  /**
   * Reset all component states
   */
  reset() {
    Object.values(this.components).forEach(component => {
      if (component.reset) component.reset()
    })

    this.metrics = {
      totalAnalyses: 0,
      semanticAnalyses: 0,
      traditionalAnalyses: 0,
      combinedAccuracy: 0,
      averageTime: 0
    }
  }

  /**
   * Shutdown all components
   */
  async shutdown() {
    const shutdownPromises = Object.values(this.components).map(component => {
      if (component.shutdown) return component.shutdown()
      return Promise.resolve()
    })

    await Promise.all(shutdownPromises)
    this.logger.info('Integrated Drift Detector shutdown complete')
  }
}

export default IntegratedDriftDetector