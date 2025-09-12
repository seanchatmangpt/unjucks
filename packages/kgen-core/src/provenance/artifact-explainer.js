/**
 * Enhanced Artifact Explainer - Perfect Auditability from Artifact to Source Graph
 * 
 * Provides complete explanations of how any KGEN artifact was generated,
 * including full lineage chains, template usage, rule applications, and
 * cryptographic verification of the entire generation process.
 */

import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';
import { AttestationGenerator } from './attestation.js';
import { CryptographicVerifier } from './verification.js';
import { ProvenanceQueries } from './queries/sparql.js';

export class ArtifactExplainer {
  constructor(config = {}) {
    this.config = {
      // Explanation depth
      maxLineageDepth: 10,
      includeFullLineage: true,
      includeTemplateSource: true,
      includeRuleSource: true,
      includeEnvironmentSnapshot: true,
      
      // Verification settings
      enableCryptographicVerification: true,
      enableIntegrityChecking: true,
      enableSignatureValidation: true,
      
      // Output formats
      outputFormat: 'comprehensive', // summary, detailed, comprehensive
      includeGraphVisualization: false,
      includeComplianceReport: true,
      
      // Performance
      enableCaching: true,
      cacheTimeout: 10 * 60 * 1000, // 10 minutes
      
      ...config
    };
    
    this.logger = consola.withTag('artifact-explainer');
    this.attestationGenerator = new AttestationGenerator(config);
    this.verifier = new CryptographicVerifier(config);
    this.queries = new ProvenanceQueries(null, config);
    
    this.explanationCache = new Map();
    this.metrics = {
      explanationsGenerated: 0,
      verificationsPassed: 0,
      verificationsFailed: 0,
      lineageDepthMax: 0,
      averageExplanationTime: 0
    };
  }

  /**
   * Generate comprehensive explanation for an artifact
   * @param {string} artifactPath - Path to the artifact
   * @param {Object} options - Explanation options
   * @returns {Promise<Object>} Complete artifact explanation
   */
  async explainArtifact(artifactPath, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const explanationId = uuidv4();
    
    try {
      this.logger.info(`Generating explanation for ${path.basename(artifactPath)}`);
      
      // Check cache first
      if (this.config.enableCaching && !options.skipCache) {
        const cached = this.getCachedExplanation(artifactPath);
        if (cached) {
          this.logger.debug('Returning cached explanation');
          return cached;
        }
      }
      
      const explanation = {
        explanationId,
        artifact: {
          path: path.resolve(artifactPath),
          exists: false,
          hash: null,
          size: 0,
          created: null,
          modified: null
        },
        attestation: null,
        verification: null,
        lineage: null,
        generation: null,
        compliance: null,
        summary: null,
        metrics: {
          explanationTime: 0,
          lineageDepth: 0,
          verificationsPerformed: 0
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      // Step 1: Verify artifact exists and get basic information
      await this.analyzeArtifact(artifactPath, explanation);
      
      // Step 2: Load and analyze attestation
      await this.analyzeAttestation(artifactPath, explanation, options);
      
      // Step 3: Perform cryptographic verification
      if (this.config.enableCryptographicVerification) {
        await this.performVerification(artifactPath, explanation);
      }
      
      // Step 4: Build complete lineage chain
      if (this.config.includeFullLineage) {
        await this.buildLineageChain(explanation, options);
      }
      
      // Step 5: Analyze generation process
      await this.analyzeGeneration(explanation, options);
      
      // Step 6: Generate compliance report
      if (this.config.includeComplianceReport) {
        await this.generateComplianceReport(explanation);
      }
      
      // Step 7: Generate summary
      explanation.summary = this.generateSummary(explanation);
      
      // Update metrics
      explanation.metrics.explanationTime = this.getDeterministicTimestamp() - startTime;
      this.updateMetrics(explanation);
      
      // Cache result
      if (this.config.enableCaching) {
        this.cacheExplanation(artifactPath, explanation);
      }
      
      this.logger.success(`Explanation generated for ${path.basename(artifactPath)} in ${explanation.metrics.explanationTime}ms`);
      
      return explanation;
    } catch (error) {
      this.logger.error(`Failed to explain artifact ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Analyze basic artifact information
   * @param {string} artifactPath - Path to artifact
   * @param {Object} explanation - Explanation object to update
   * @returns {Promise<void>}
   */
  async analyzeArtifact(artifactPath, explanation) {
    try {
      const stats = await fs.stat(artifactPath);
      const hash = await this.attestationGenerator.calculateFileHash(artifactPath);
      
      explanation.artifact = {
        path: path.resolve(artifactPath),
        relativePath: path.relative(process.cwd(), artifactPath),
        exists: true,
        hash: `sha256:${hash}`,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        type: this.detectArtifactType(artifactPath),
        encoding: await this.detectEncoding(artifactPath)
      };
    } catch (error) {
      explanation.artifact.exists = false;
      explanation.artifact.error = error.message;
    }
  }

  /**
   * Load and analyze attestation
   * @param {string} artifactPath - Path to artifact
   * @param {Object} explanation - Explanation object to update
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async analyzeAttestation(artifactPath, explanation, options) {
    try {
      // Try to find attestation file
      const attestationPath = options.attestationPath || (artifactPath + '.attest.json');
      
      let attestation = null;
      try {
        const attestationContent = await fs.readFile(attestationPath, 'utf8');
        attestation = JSON.parse(attestationContent);
      } catch {
        // No attestation found - try to generate one
        if (options.generateAttestation) {
          this.logger.info('No attestation found, generating new one');
          attestation = await this.attestationGenerator.generateAttestation(
            artifactPath, 
            options.generationMetadata || {}
          );
        }
      }
      
      if (attestation) {
        explanation.attestation = {
          found: true,
          path: attestationPath,
          data: attestation,
          analysis: await this.analyzeAttestationContent(attestation)
        };
      } else {
        explanation.attestation = {
          found: false,
          path: attestationPath,
          data: null,
          analysis: null
        };
      }
    } catch (error) {
      explanation.attestation = {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Perform cryptographic verification
   * @param {string} artifactPath - Path to artifact
   * @param {Object} explanation - Explanation object to update
   * @returns {Promise<void>}
   */
  async performVerification(artifactPath, explanation) {
    try {
      const verificationResult = await this.verifier.verifyArtifact(
        artifactPath,
        explanation.attestation?.data
      );
      
      explanation.verification = {
        performed: true,
        result: verificationResult,
        summary: {
          valid: verificationResult.valid,
          errorCount: verificationResult.errors.length,
          warningCount: verificationResult.warnings.length,
          checksPerformed: Object.keys(verificationResult.checks).length
        }
      };
      
      explanation.metrics.verificationsPerformed++;
      
      if (verificationResult.valid) {
        this.metrics.verificationsPassed++;
      } else {
        this.metrics.verificationsFailed++;
      }
    } catch (error) {
      explanation.verification = {
        performed: false,
        error: error.message
      };
    }
  }

  /**
   * Build complete lineage chain
   * @param {Object} explanation - Explanation object to update
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async buildLineageChain(explanation, options) {
    try {
      const lineage = {
        chain: [],
        depth: 0,
        sources: [],
        templates: [],
        rules: [],
        dependencies: []
      };
      
      // Extract lineage from attestation if available
      if (explanation.attestation?.data?.lineage) {
        lineage.chain = explanation.attestation.data.lineage;
        lineage.depth = lineage.chain.length;
      }
      
      // Analyze each lineage item
      for (const item of lineage.chain) {
        const analysis = await this.analyzeLineageItem(item);
        
        switch (item.type) {
          case 'source':
            lineage.sources.push(analysis);
            break;
          case 'template':
            lineage.templates.push(analysis);
            break;
          case 'rules':
            lineage.rules.push(analysis);
            break;
          case 'dependency':
            lineage.dependencies.push(analysis);
            break;
        }
      }
      
      // Build dependency graph
      lineage.dependencyGraph = await this.buildDependencyGraph(lineage.chain);
      
      // Calculate lineage metrics
      lineage.metrics = {
        totalItems: lineage.chain.length,
        sourceCount: lineage.sources.length,
        templateCount: lineage.templates.length,
        ruleCount: lineage.rules.length,
        dependencyCount: lineage.dependencies.length,
        maxDepth: Math.max(...lineage.chain.map((item, index) => index + 1))
      };
      
      explanation.lineage = lineage;
      explanation.metrics.lineageDepth = lineage.depth;
      
      if (lineage.depth > this.metrics.lineageDepthMax) {
        this.metrics.lineageDepthMax = lineage.depth;
      }
    } catch (error) {
      explanation.lineage = {
        error: error.message,
        chain: [],
        depth: 0
      };
    }
  }

  /**
   * Analyze generation process
   * @param {Object} explanation - Explanation object to update
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async analyzeGeneration(explanation, options) {
    try {
      const generation = {
        process: null,
        templates: [],
        rules: [],
        environment: null,
        configuration: null,
        performance: null
      };
      
      // Extract generation info from attestation
      if (explanation.attestation?.data?.generation) {
        const gen = explanation.attestation.data.generation;
        
        generation.process = {
          engine: gen.engine,
          timestamp: gen.timestamp,
          operationId: gen.operationId,
          graphHash: gen.graphHash
        };
        
        // Analyze templates
        if (gen.template && this.config.includeTemplateSource) {
          generation.templates.push(await this.analyzeTemplate(gen.template));
        }
        
        // Analyze rules
        if (gen.rules && this.config.includeRuleSource) {
          generation.rules.push(await this.analyzeRules(gen.rules));
        }
      }
      
      // Extract environment info
      if (explanation.attestation?.data?.environment && this.config.includeEnvironmentSnapshot) {
        generation.environment = {
          captured: true,
          data: explanation.attestation.data.environment,
          analysis: this.analyzeEnvironment(explanation.attestation.data.environment)
        };
      }
      
      // Extract provenance info
      if (explanation.attestation?.data?.provenance) {
        generation.provenance = {
          standard: 'W3C-PROV-O',
          compliant: this.verifier.verifyProvOCompliance(explanation.attestation.data.provenance),
          data: explanation.attestation.data.provenance
        };
      }
      
      explanation.generation = generation;
    } catch (error) {
      explanation.generation = {
        error: error.message
      };
    }
  }

  /**
   * Generate compliance report
   * @param {Object} explanation - Explanation object to update
   * @returns {Promise<void>}
   */
  async generateComplianceReport(explanation) {
    try {
      const compliance = {
        overall: 'COMPLIANT',
        checks: [],
        issues: [],
        recommendations: []
      };
      
      // Check attestation presence
      if (!explanation.attestation?.found) {
        compliance.checks.push({
          name: 'Attestation Present',
          status: 'FAIL',
          message: 'No attestation file found'
        });
        compliance.issues.push('Missing attestation file');
        compliance.overall = 'NON_COMPLIANT';
      } else {
        compliance.checks.push({
          name: 'Attestation Present',
          status: 'PASS',
          message: 'Attestation file found and loaded'
        });
      }
      
      // Check cryptographic verification
      if (explanation.verification?.result?.valid) {
        compliance.checks.push({
          name: 'Cryptographic Verification',
          status: 'PASS',
          message: 'All cryptographic checks passed'
        });
      } else if (explanation.verification?.performed) {
        compliance.checks.push({
          name: 'Cryptographic Verification',
          status: 'FAIL',
          message: `Verification failed: ${explanation.verification.result.errors.join(', ')}`
        });
        compliance.issues.push('Cryptographic verification failed');
        compliance.overall = 'NON_COMPLIANT';
      }
      
      // Check PROV-O compliance
      if (explanation.generation?.provenance?.compliant) {
        compliance.checks.push({
          name: 'PROV-O Compliance',
          status: 'PASS',
          message: 'Provenance data is W3C PROV-O compliant'
        });
      } else {
        compliance.checks.push({
          name: 'PROV-O Compliance',
          status: 'WARN',
          message: 'Provenance data may not be fully PROV-O compliant'
        });
        compliance.recommendations.push('Ensure full PROV-O compliance for enterprise requirements');
      }
      
      // Check lineage completeness
      if (explanation.lineage?.depth > 0) {
        compliance.checks.push({
          name: 'Lineage Completeness',
          status: 'PASS',
          message: `Complete lineage chain with ${explanation.lineage.depth} items`
        });
      } else {
        compliance.checks.push({
          name: 'Lineage Completeness',
          status: 'WARN',
          message: 'No lineage information available'
        });
        compliance.recommendations.push('Ensure complete lineage tracking for audit requirements');
      }
      
      // Generate compliance score
      const passCount = compliance.checks.filter(c => c.status === 'PASS').length;
      const totalCount = compliance.checks.length;
      compliance.score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
      
      explanation.compliance = compliance;
    } catch (error) {
      explanation.compliance = {
        overall: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * Generate summary of explanation
   * @param {Object} explanation - Complete explanation object
   * @returns {Object} Summary object
   */
  generateSummary(explanation) {
    const summary = {
      artifact: {
        name: path.basename(explanation.artifact.path),
        type: explanation.artifact.type,
        size: explanation.artifact.size,
        exists: explanation.artifact.exists
      },
      
      provenance: {
        attestationFound: explanation.attestation?.found || false,
        verificationPassed: explanation.verification?.result?.valid || false,
        lineageDepth: explanation.lineage?.depth || 0,
        complianceScore: explanation.compliance?.score || 0
      },
      
      generation: {
        engine: explanation.generation?.process?.engine || 'unknown',
        timestamp: explanation.generation?.process?.timestamp || null,
        templates: explanation.generation?.templates?.length || 0,
        rules: explanation.generation?.rules?.length || 0
      },
      
      quality: {
        overall: this.calculateOverallQuality(explanation),
        issues: explanation.compliance?.issues?.length || 0,
        recommendations: explanation.compliance?.recommendations?.length || 0
      },
      
      auditability: {
        level: this.calculateAuditabilityLevel(explanation),
        traceableToSource: explanation.lineage?.sources?.length > 0,
        cryptographicallySecure: explanation.verification?.result?.valid || false
      }
    };
    
    return summary;
  }

  /**
   * Analyze attestation content
   * @param {Object} attestation - Attestation data
   * @returns {Object} Analysis result
   */
  async analyzeAttestationContent(attestation) {
    return {
      version: attestation.version,
      size: JSON.stringify(attestation).length,
      hasSignature: !!attestation.signature,
      hasProvenance: !!attestation.provenance,
      hasLineage: !!attestation.lineage,
      hasEnvironment: !!attestation.environment,
      generationTime: attestation.metrics?.generationTime || null,
      complianceLevel: attestation.compliance?.level || 'unknown'
    };
  }

  /**
   * Analyze lineage item
   * @param {Object} item - Lineage item
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeLineageItem(item) {
    const analysis = {
      type: item.type,
      resource: item.resource,
      hash: item.hash,
      timestamp: item.timestamp,
      exists: false,
      analyzed: false
    };
    
    try {
      // Check if resource exists and analyze it
      if (item.resource && typeof item.resource === 'string') {
        const exists = await this.fileExists(item.resource);
        analysis.exists = exists;
        
        if (exists) {
          const stats = await fs.stat(item.resource);
          analysis.size = stats.size;
          analysis.modified = stats.mtime.toISOString();
          
          // Verify hash if provided
          if (item.hash) {
            const currentHash = await this.attestationGenerator.calculateFileHash(item.resource);
            const [, expectedHash] = item.hash.split(':');
            analysis.hashVerified = currentHash === expectedHash;
          }
        }
      }
      
      analysis.analyzed = true;
    } catch (error) {
      analysis.error = error.message;
    }
    
    return analysis;
  }

  /**
   * Build dependency graph
   * @param {Array} lineageChain - Lineage chain
   * @returns {Object} Dependency graph
   */
  async buildDependencyGraph(lineageChain) {
    const graph = {
      nodes: [],
      edges: [],
      levels: []
    };
    
    // Create nodes for each lineage item
    lineageChain.forEach((item, index) => {
      graph.nodes.push({
        id: `node_${index}`,
        type: item.type,
        resource: item.resource,
        hash: item.hash,
        timestamp: item.timestamp,
        level: index
      });
    });
    
    // Create edges based on dependencies
    for (let i = 1; i < graph.nodes.length; i++) {
      graph.edges.push({
        from: `node_${i - 1}`,
        to: `node_${i}`,
        relationship: 'dependsOn'
      });
    }
    
    // Group by levels
    const levelMap = new Map();
    graph.nodes.forEach(node => {
      if (!levelMap.has(node.level)) {
        levelMap.set(node.level, []);
      }
      levelMap.get(node.level).push(node);
    });
    
    graph.levels = Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0]);
    
    return graph;
  }

  /**
   * Analyze template
   * @param {string} template - Template identifier
   * @returns {Promise<Object>} Template analysis
   */
  async analyzeTemplate(template) {
    return {
      id: template,
      type: 'template',
      analyzed: this.getDeterministicDate().toISOString(),
      // This would be expanded with actual template analysis
      metadata: {
        source: 'template registry',
        analyzed: true
      }
    };
  }

  /**
   * Analyze rules
   * @param {string} rules - Rules identifier
   * @returns {Promise<Object>} Rules analysis
   */
  async analyzeRules(rules) {
    return {
      id: rules,
      type: 'rules',
      analyzed: this.getDeterministicDate().toISOString(),
      // This would be expanded with actual rules analysis
      metadata: {
        source: 'rules registry',
        analyzed: true
      }
    };
  }

  /**
   * Analyze environment
   * @param {Object} environment - Environment data
   * @returns {Object} Environment analysis
   */
  analyzeEnvironment(environment) {
    return {
      nodeVersion: environment.node?.version,
      platform: environment.system?.type,
      hostname: environment.system?.hostname,
      workingDirectory: environment.working_directory,
      secure: !environment.hostname?.includes('localhost'),
      reproducible: !!environment.environment_hash
    };
  }

  /**
   * Calculate overall quality score
   * @param {Object} explanation - Complete explanation
   * @returns {string} Quality level
   */
  calculateOverallQuality(explanation) {
    let score = 0;
    
    if (explanation.artifact?.exists) score += 20;
    if (explanation.attestation?.found) score += 20;
    if (explanation.verification?.result?.valid) score += 30;
    if (explanation.lineage?.depth > 0) score += 20;
    if (explanation.compliance?.score >= 80) score += 10;
    
    if (score >= 90) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'FAIR';
    return 'POOR';
  }

  /**
   * Calculate auditability level
   * @param {Object} explanation - Complete explanation
   * @returns {string} Auditability level
   */
  calculateAuditabilityLevel(explanation) {
    const hasAttestation = explanation.attestation?.found;
    const hasVerification = explanation.verification?.result?.valid;
    const hasLineage = explanation.lineage?.depth > 0;
    const hasCompliance = explanation.compliance?.score >= 80;
    
    if (hasAttestation && hasVerification && hasLineage && hasCompliance) {
      return 'ENTERPRISE';
    } else if (hasAttestation && (hasVerification || hasLineage)) {
      return 'STANDARD';
    } else if (hasAttestation) {
      return 'BASIC';
    } else {
      return 'NONE';
    }
  }

  /**
   * Detect artifact type
   * @param {string} artifactPath - Path to artifact
   * @returns {string} Artifact type
   */
  detectArtifactType(artifactPath) {
    const ext = path.extname(artifactPath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'stylesheet',
      '.md': 'markdown',
      '.txt': 'text',
      '.xml': 'xml',
      '.ttl': 'turtle-rdf',
      '.rdf': 'rdf-xml',
      '.jsonld': 'json-ld'
    };
    
    return typeMap[ext] || 'unknown';
  }

  /**
   * Detect file encoding
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} Detected encoding
   */
  async detectEncoding(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      // Simple heuristic - check for BOM or assume UTF-8
      if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf8-bom';
      }
      return 'utf8';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} True if exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache explanation result
   * @param {string} artifactPath - Artifact path
   * @param {Object} explanation - Explanation to cache
   */
  cacheExplanation(artifactPath, explanation) {
    const key = path.resolve(artifactPath);
    this.explanationCache.set(key, {
      explanation,
      timestamp: this.getDeterministicTimestamp(),
      expires: this.getDeterministicTimestamp() + this.config.cacheTimeout
    });
  }

  /**
   * Get cached explanation
   * @param {string} artifactPath - Artifact path
   * @returns {Object|null} Cached explanation or null
   */
  getCachedExplanation(artifactPath) {
    const key = path.resolve(artifactPath);
    const entry = this.explanationCache.get(key);
    
    if (entry && this.getDeterministicTimestamp() < entry.expires) {
      return entry.explanation;
    }
    
    if (entry) {
      this.explanationCache.delete(key);
    }
    
    return null;
  }

  /**
   * Update internal metrics
   * @param {Object} explanation - Explanation object
   */
  updateMetrics(explanation) {
    this.metrics.explanationsGenerated++;
    
    const totalTime = this.metrics.averageExplanationTime * (this.metrics.explanationsGenerated - 1);
    this.metrics.averageExplanationTime = (totalTime + explanation.metrics.explanationTime) / this.metrics.explanationsGenerated;
  }

  /**
   * Get explainer metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.explanationCache.size
    };
  }

  /**
   * Clear caches and reset
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.explanationCache.clear();
    await this.verifier.shutdown();
    this.logger.info('Artifact explainer shutdown complete');
  }
}

export default ArtifactExplainer;