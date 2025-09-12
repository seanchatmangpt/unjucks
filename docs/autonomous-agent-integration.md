# KGEN Autonomous Agent Integration Guide

## Overview

This guide provides comprehensive examples and patterns for integrating autonomous agents with KGEN resolver systems. It includes practical code examples, error handling patterns, and performance optimization strategies.

## Basic Integration Pattern

### Agent Resolver Manager

```javascript
/**
 * Autonomous Agent Resolver Manager
 * Provides unified interface to all KGEN resolvers with error handling,
 * retry logic, and performance monitoring.
 */
export class AgentResolverManager {
  constructor(config = {}) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableMetrics: true,
      ...config
    };
    
    this.resolvers = new Map();
    this.metrics = new Map();
    
    this.initializeResolvers();
  }
  
  /**
   * Initialize all resolver instances
   */
  async initializeResolvers() {
    const { PathResolver } = await import('../src/kgen/core/frontmatter/path-resolver.js');
    const { ContentUriResolver } = await import('../src/kgen/cas/content-uri-resolver.js');
    const { AttestResolver } = await import('../src/kgen/attestation/attest-resolver.js');
    const { DriftURIResolver } = await import('../src/kgen/drift/drift-uri-resolver.js');
    const { PolicyURIResolver } = await import('../src/kgen/validation/policy-resolver.js');
    
    // Initialize with agent-optimized configurations
    this.resolvers.set('path', new PathResolver({
      deterministic: true,
      enableConflictDetection: true,
      cacheSize: 10000
    }));
    
    this.resolvers.set('content', new ContentUriResolver({
      enableHardlinks: true,
      integrityChecks: true,
      cacheSize: 5000
    }));
    
    this.resolvers.set('attest', new AttestResolver({
      verificationEnabled: true,
      requireSignature: true,
      cacheSize: 2000
    }));
    
    this.resolvers.set('drift', new DriftURIResolver({
      performance: { cachePatches: true, batchSize: 20 }
    }));
    
    this.resolvers.set('policy', new PolicyURIResolver({
      enableVerdictTracking: true,
      strictMode: true
    }));
    
    // Initialize all resolvers
    await Promise.all([...this.resolvers.values()].map(r => r.initialize?.()));
  }
  
  /**
   * Resolve any URI with automatic resolver selection and error handling
   */
  async resolveURI(uri, options = {}) {
    const resolver = this.getResolverForURI(uri);
    const startTime = performance.now();
    
    try {
      const result = await this.executeWithRetry(
        () => resolver.resolve(uri, options),
        this.config.retryAttempts
      );
      
      this.recordMetric('success', uri, performance.now() - startTime);
      return { success: true, data: result, uri };
      
    } catch (error) {
      this.recordMetric('error', uri, performance.now() - startTime, error);
      return { 
        success: false, 
        error: this.normalizeError(error),
        uri,
        retryable: this.isRetryableError(error)
      };
    }
  }
  
  /**
   * Batch resolve multiple URIs efficiently
   */
  async batchResolve(uris, options = {}) {
    const { concurrency = 5 } = options;
    const results = new Map();
    
    // Group URIs by resolver type
    const uriGroups = new Map();
    uris.forEach(uri => {
      const resolverType = this.getResolverTypeForURI(uri);
      if (!uriGroups.has(resolverType)) {
        uriGroups.set(resolverType, []);
      }
      uriGroups.get(resolverType).push(uri);
    });
    
    // Process each group with appropriate concurrency
    for (const [resolverType, groupUris] of uriGroups) {
      const resolver = this.resolvers.get(resolverType);
      
      // Use resolver-specific batch methods if available
      if (resolver.batchResolve) {
        const batchResults = await resolver.batchResolve(
          groupUris.map(uri => ({ uri, options }))
        );
        batchResults.results.forEach((result, index) => {
          results.set(groupUris[index], result);
        });
      } else {
        // Fall back to controlled concurrent resolution
        const chunks = this.chunkArray(groupUris, concurrency);
        
        for (const chunk of chunks) {
          const promises = chunk.map(uri => this.resolveURI(uri, options));
          const chunkResults = await Promise.allSettled(promises);
          
          chunkResults.forEach((result, index) => {
            const uri = chunk[index];
            results.set(uri, result.status === 'fulfilled' ? result.value : {
              success: false,
              error: result.reason,
              uri
            });
          });
        }
      }
    }
    
    return results;
  }
  
  // Helper methods...
  getResolverForURI(uri) {
    const type = this.getResolverTypeForURI(uri);
    const resolver = this.resolvers.get(type);
    if (!resolver) {
      throw new Error(`No resolver found for URI: ${uri}`);
    }
    return resolver;
  }
  
  getResolverTypeForURI(uri) {
    if (uri.startsWith('content://')) return 'content';
    if (uri.startsWith('attest://')) return 'attest';
    if (uri.startsWith('drift://')) return 'drift';
    if (uri.startsWith('policy://')) return 'policy';
    throw new Error(`Unsupported URI scheme: ${uri}`);
  }
  
  async executeWithRetry(operation, maxAttempts) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts || !this.isRetryableError(error)) {
          throw error;
        }
        await this.delay(this.config.retryDelay * attempt);
      }
    }
  }
  
  isRetryableError(error) {
    const retryableCodes = [
      'TIMEOUT',
      'NETWORK_ERROR', 
      'STORAGE_BUSY',
      'TEMPORARY_FAILURE'
    ];
    return retryableCodes.some(code => error.code?.includes(code));
  }
  
  recordMetric(type, uri, duration, error = null) {
    if (!this.config.enableMetrics) return;
    
    const resolverType = this.getResolverTypeForURI(uri);
    const key = `${resolverType}_${type}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, { count: 0, totalDuration: 0, errors: [] });
    }
    
    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalDuration += duration;
    
    if (error) {
      metric.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        code: error.code
      });
    }
  }
  
  getMetrics() {
    const summary = {};
    for (const [key, metric] of this.metrics) {
      summary[key] = {
        count: metric.count,
        averageDuration: metric.count > 0 ? metric.totalDuration / metric.count : 0,
        errorRate: metric.errors.length / metric.count,
        recentErrors: metric.errors.slice(-5)
      };
    }
    return summary;
  }
  
  normalizeError(error) {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details || {},
      timestamp: new Date().toISOString()
    };
  }
  
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Specific Integration Examples

### 1. Content-Addressed File Management Agent

```javascript
/**
 * Agent for managing content-addressed files with automatic deduplication
 */
export class ContentManagementAgent {
  constructor(resolverManager) {
    this.resolvers = resolverManager;
    this.contentCache = new Map();
  }
  
  /**
   * Store file content and return URI
   */
  async storeFile(filePath, metadata = {}) {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath);
      
      const resolver = this.resolvers.resolvers.get('content');
      const result = await resolver.store(content, {
        source: filePath,
        extension: path.extname(filePath),
        metadata: {
          originalPath: filePath,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      });
      
      // Cache for quick access
      this.contentCache.set(result.uri, {
        path: result.path,
        size: result.size,
        stored: result.stored
      });
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to store file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Retrieve file content by URI
   */
  async retrieveFile(uri, outputPath = null) {
    try {
      const resolver = this.resolvers.resolvers.get('content');
      const content = await resolver.getContent(uri);
      
      if (outputPath) {
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, content);
        return { uri, outputPath, size: content.length };
      }
      
      return { uri, content, size: content.length };
      
    } catch (error) {
      throw new Error(`Failed to retrieve file ${uri}: ${error.message}`);
    }
  }
  
  /**
   * Check if content exists and get metadata
   */
  async checkContent(uri) {
    const resolver = this.resolvers.resolvers.get('content');
    const exists = await resolver.exists(uri);
    
    if (!exists) {
      return { exists: false, uri };
    }
    
    const resolved = await resolver.resolve(uri);
    return {
      exists: true,
      uri,
      size: resolved.size,
      path: resolved.path,
      metadata: resolved.metadata
    };
  }
}
```

### 2. Template Validation Agent with Policy Enforcement

```javascript
/**
 * Agent for validating templates with automated policy enforcement
 */
export class TemplateValidationAgent {
  constructor(resolverManager) {
    this.resolvers = resolverManager;
    this.validationResults = new Map();
  }
  
  /**
   * Validate template against security policies
   */
  async validateTemplate(templatePath, templateContent) {
    const validationId = `validation_${Date.now()}`;
    
    try {
      // Step 1: Validate template security
      const securityResult = await this.resolvers.resolveURI(
        'policy://template-security/pass',
        {
          templatePath,
          templateContent,
          templateName: path.basename(templatePath)
        }
      );
      
      // Step 2: Check template constraints
      const constraintResult = await this.resolvers.resolveURI(
        'policy://template-constraints/pass',
        {
          templatePath,
          templateContent
        }
      );
      
      // Step 3: Validate SHACL constraints if RDF content
      let shaclResult = { success: true, data: { passed: true } };
      if (this.containsRDFContent(templateContent)) {
        shaclResult = await this.resolvers.resolveURI(
          'policy://shacl-validation/pass',
          {
            dataGraph: this.extractRDFContent(templateContent)
          }
        );
      }
      
      // Compile validation results
      const overallResult = {
        validationId,
        templatePath,
        timestamp: new Date().toISOString(),
        security: securityResult,
        constraints: constraintResult,
        shacl: shaclResult,
        overallPassed: securityResult.success && 
                      constraintResult.success && 
                      shaclResult.success,
        recommendations: this.generateRecommendations([
          securityResult, constraintResult, shaclResult
        ])
      };
      
      this.validationResults.set(validationId, overallResult);
      
      return overallResult;
      
    } catch (error) {
      const errorResult = {
        validationId,
        templatePath,
        timestamp: new Date().toISOString(),
        error: error.message,
        overallPassed: false
      };
      
      this.validationResults.set(validationId, errorResult);
      return errorResult;
    }
  }
  
  /**
   * Create attestation for validated template
   */
  async createValidationAttestation(validationId, signingKey = null) {
    const validationResult = this.validationResults.get(validationId);
    if (!validationResult) {
      throw new Error(`Validation result not found: ${validationId}`);
    }
    
    const resolver = this.resolvers.resolvers.get('attest');
    const attestation = await resolver.createAttestation(validationResult, {
      subject: `template-validation-${validationId}`,
      issuer: 'kgen-validation-agent',
      contentType: 'application/json',
      signingKey,
      customClaims: {
        'urn:kgen:template-security-passed': validationResult.security?.success || false,
        'urn:kgen:template-constraints-passed': validationResult.constraints?.success || false,
        'urn:kgen:shacl-validation-passed': validationResult.shacl?.success || false,
        'urn:kgen:overall-validation-passed': validationResult.overallPassed
      }
    });
    
    const attestUri = await resolver.store(attestation);
    
    // Link attestation to validation result
    validationResult.attestationUri = attestUri;
    this.validationResults.set(validationId, validationResult);
    
    return { attestUri, attestation, validationId };
  }
  
  containsRDFContent(content) {
    // Simple heuristic to detect RDF content
    return content.includes('@prefix') || 
           content.includes('@context') ||
           content.includes('turtle') ||
           content.includes('jsonld');
  }
  
  extractRDFContent(content) {
    // Extract RDF portions from template content
    // This is a simplified implementation
    const rdfBlocks = content.match(/<rdf>([\s\S]*?)<\/rdf>/g);
    if (rdfBlocks) {
      return rdfBlocks.map(block => 
        block.replace(/<\/?rdf>/g, '')
      ).join('\n');
    }
    return '';
  }
  
  generateRecommendations(results) {
    const recommendations = [];
    
    results.forEach(result => {
      if (!result.success && result.error) {
        switch (result.error.code) {
          case 'POLICY_TEMPLATE_SECURITY_FAILED':
            recommendations.push({
              type: 'security',
              priority: 'high',
              message: 'Review template for security vulnerabilities',
              action: 'Remove potentially dangerous template constructs'
            });
            break;
            
          case 'POLICY_TEMPLATE_CONSTRAINTS_FAILED':
            recommendations.push({
              type: 'constraints',
              priority: 'medium',
              message: 'Template violates structural constraints',
              action: 'Ensure template follows required patterns'
            });
            break;
            
          case 'POLICY_SHACL_VALIDATION_FAILED':
            recommendations.push({
              type: 'data-model',
              priority: 'low',
              message: 'RDF data model validation failed',
              action: 'Review RDF structure and constraints'
            });
            break;
        }
      }
    });
    
    return recommendations;
  }
}
```

### 3. Drift Detection and Analysis Agent

```javascript
/**
 * Agent for detecting and analyzing semantic drift in artifacts
 */
export class DriftAnalysisAgent {
  constructor(resolverManager) {
    this.resolvers = resolverManager;
    this.baselineStore = new Map();
    this.driftHistory = [];
  }
  
  /**
   * Establish baseline for drift detection
   */
  async establishBaseline(artifactId, currentData, metadata = {}) {
    try {
      // Store baseline in content-addressed storage
      const contentResolver = this.resolvers.resolvers.get('content');
      const baselineUri = await contentResolver.store(
        JSON.stringify(currentData, null, 2),
        {
          extension: '.json',
          metadata: {
            type: 'baseline',
            artifactId,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }
      );
      
      this.baselineStore.set(artifactId, {
        uri: baselineUri.uri,
        timestamp: new Date().toISOString(),
        metadata
      });
      
      return { artifactId, baselineUri: baselineUri.uri };
      
    } catch (error) {
      throw new Error(`Failed to establish baseline for ${artifactId}: ${error.message}`);
    }
  }
  
  /**
   * Detect and analyze drift from baseline
   */
  async detectDrift(artifactId, currentData, options = {}) {
    const baseline = this.baselineStore.get(artifactId);
    if (!baseline) {
      throw new Error(`No baseline found for artifact: ${artifactId}`);
    }
    
    try {
      // Retrieve baseline data
      const contentResolver = this.resolvers.resolvers.get('content');
      const baselineContent = await contentResolver.getContentAsString(baseline.uri);
      const baselineData = JSON.parse(baselineContent);
      
      // Store current data and create patch
      const driftResolver = this.resolvers.resolvers.get('drift');
      const patchResult = await driftResolver.storePatch(baselineData, currentData, {
        source: `drift-detection-${artifactId}`,
        format: 'json'
      });
      
      if (!patchResult.patch) {
        return {
          artifactId,
          hasDrift: false,
          message: 'No changes detected from baseline'
        };
      }
      
      // Analyze drift significance
      const driftAnalysis = {
        artifactId,
        hasDrift: true,
        driftUri: patchResult.uri,
        significance: patchResult.metadata.semantic?.significance || 0,
        changeType: patchResult.metadata.semantic?.type || 'unknown',
        operations: patchResult.metadata.operations,
        timestamp: new Date().toISOString(),
        baseline: {
          uri: baseline.uri,
          timestamp: baseline.timestamp
        }
      };
      
      // Store drift analysis
      this.driftHistory.push(driftAnalysis);
      
      // Create attestation for significant changes
      if (driftAnalysis.significance > 0.3) {
        await this.createDriftAttestation(driftAnalysis);
      }
      
      return driftAnalysis;
      
    } catch (error) {
      throw new Error(`Drift detection failed for ${artifactId}: ${error.message}`);
    }
  }
  
  /**
   * Apply drift patch to reconstruct data
   */
  async applyDriftPatch(driftUri, baselineUri) {
    try {
      const driftResolver = this.resolvers.resolvers.get('drift');
      const contentResolver = this.resolvers.resolvers.get('content');
      
      // Retrieve baseline data
      const baselineContent = await contentResolver.getContentAsString(baselineUri);
      const baselineData = JSON.parse(baselineContent);
      
      // Apply patch
      const result = await driftResolver.applyPatch(baselineData, driftUri);
      
      return {
        reconstructedData: result.result,
        metadata: result.metadata
      };
      
    } catch (error) {
      throw new Error(`Failed to apply drift patch ${driftUri}: ${error.message}`);
    }
  }
  
  /**
   * Create attestation for significant drift
   */
  async createDriftAttestation(driftAnalysis) {
    try {
      const attestResolver = this.resolvers.resolvers.get('attest');
      
      const attestation = await attestResolver.createAttestation(driftAnalysis, {
        subject: `artifact-drift-${driftAnalysis.artifactId}`,
        issuer: 'kgen-drift-agent',
        contentType: 'application/json',
        customClaims: {
          'urn:kgen:drift-detected': true,
          'urn:kgen:drift-significance': driftAnalysis.significance,
          'urn:kgen:drift-type': driftAnalysis.changeType,
          'urn:kgen:requires-review': driftAnalysis.significance > 0.5
        }
      });
      
      const attestUri = await attestResolver.store(attestation);
      driftAnalysis.attestationUri = attestUri;
      
      return attestUri;
      
    } catch (error) {
      console.warn(`Failed to create drift attestation: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get drift history for artifact
   */
  getDriftHistory(artifactId) {
    return this.driftHistory.filter(entry => entry.artifactId === artifactId);
  }
  
  /**
   * Get drift statistics
   */
  getDriftStatistics() {
    const stats = {
      totalArtifacts: this.baselineStore.size,
      totalDriftDetections: this.driftHistory.length,
      significantDrifts: this.driftHistory.filter(d => d.significance > 0.3).length,
      criticalDrifts: this.driftHistory.filter(d => d.significance > 0.7).length,
      changeTypes: {}
    };
    
    // Analyze change type distribution
    this.driftHistory.forEach(drift => {
      const type = drift.changeType || 'unknown';
      stats.changeTypes[type] = (stats.changeTypes[type] || 0) + 1;
    });
    
    return stats;
  }
}
```

### 4. Comprehensive Agent Orchestration

```javascript
/**
 * Master agent that orchestrates multiple specialized agents
 */
export class KGenAgentOrchestrator {
  constructor(config = {}) {
    this.config = config;
    this.resolverManager = new AgentResolverManager(config.resolver);
    this.agents = new Map();
    
    this.initializeAgents();
  }
  
  async initializeAgents() {
    await this.resolverManager.initializeResolvers();
    
    this.agents.set('content', new ContentManagementAgent(this.resolverManager));
    this.agents.set('validation', new TemplateValidationAgent(this.resolverManager));
    this.agents.set('drift', new DriftAnalysisAgent(this.resolverManager));
  }
  
  /**
   * Process a complete artifact lifecycle
   */
  async processArtifact(artifactPath, options = {}) {
    const artifactId = options.artifactId || path.basename(artifactPath);
    const results = {
      artifactId,
      artifactPath,
      timestamp: new Date().toISOString(),
      steps: {}
    };
    
    try {
      // Step 1: Store artifact content
      const contentAgent = this.agents.get('content');
      const contentResult = await contentAgent.storeFile(artifactPath, {
        artifactId,
        processedBy: 'orchestrator'
      });
      results.steps.content = contentResult;
      
      // Step 2: Validate if template
      if (this.isTemplate(artifactPath)) {
        const validationAgent = this.agents.get('validation');
        const fs = await import('fs/promises');
        const templateContent = await fs.readFile(artifactPath, 'utf8');
        
        const validationResult = await validationAgent.validateTemplate(
          artifactPath, 
          templateContent
        );
        results.steps.validation = validationResult;
        
        // Create attestation if validation passed
        if (validationResult.overallPassed) {
          const attestationResult = await validationAgent.createValidationAttestation(
            validationResult.validationId
          );
          results.steps.attestation = attestationResult;
        }
      }
      
      // Step 3: Establish baseline for drift detection
      const driftAgent = this.agents.get('drift');
      const artifactData = await this.loadArtifactData(artifactPath);
      const baselineResult = await driftAgent.establishBaseline(
        artifactId,
        artifactData,
        { source: 'orchestrator', version: '1.0' }
      );
      results.steps.baseline = baselineResult;
      
      results.success = true;
      
    } catch (error) {
      results.success = false;
      results.error = error.message;
      results.stack = error.stack;
    }
    
    return results;
  }
  
  /**
   * Monitor and update existing artifacts
   */
  async monitorArtifact(artifactId, currentPath) {
    const driftAgent = this.agents.get('drift');
    
    try {
      const currentData = await this.loadArtifactData(currentPath);
      const driftResult = await driftAgent.detectDrift(artifactId, currentData);
      
      if (driftResult.hasDrift && driftResult.significance > 0.3) {
        // Significant drift detected, trigger validation
        if (this.isTemplate(currentPath)) {
          const validationAgent = this.agents.get('validation');
          const fs = await import('fs/promises');
          const templateContent = await fs.readFile(currentPath, 'utf8');
          
          const validationResult = await validationAgent.validateTemplate(
            currentPath, 
            templateContent
          );
          
          driftResult.revalidation = validationResult;
        }
      }
      
      return driftResult;
      
    } catch (error) {
      return {
        artifactId,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      resolvers: this.resolverManager.getMetrics(),
      agents: {}
    };
    
    // Get drift agent statistics
    const driftAgent = this.agents.get('drift');
    status.agents.drift = driftAgent.getDriftStatistics();
    
    // Get validation agent statistics
    const validationAgent = this.agents.get('validation');
    status.agents.validation = {
      totalValidations: validationAgent.validationResults.size,
      passedValidations: Array.from(validationAgent.validationResults.values())
        .filter(v => v.overallPassed).length
    };
    
    return status;
  }
  
  // Helper methods
  isTemplate(filePath) {
    const templateExtensions = ['.njk', '.j2', '.hbs', '.mustache', '.ejs'];
    return templateExtensions.some(ext => filePath.endsWith(ext));
  }
  
  async loadArtifactData(filePath) {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf8');
    
    try {
      return JSON.parse(content);
    } catch {
      return { content, type: 'text' };
    }
  }
}
```

## Usage Examples

### Basic Agent Setup

```javascript
import { KGenAgentOrchestrator } from './autonomous-agent-integration.js';

// Initialize orchestrator with configuration
const orchestrator = new KGenAgentOrchestrator({
  resolver: {
    retryAttempts: 3,
    timeout: 30000,
    enableMetrics: true
  }
});

await orchestrator.initializeAgents();

// Process a new artifact
const result = await orchestrator.processArtifact('./templates/component.njk', {
  artifactId: 'component-template-v1'
});

console.log('Processing result:', result);
```

### Monitoring Existing Artifacts

```javascript
// Set up monitoring loop
setInterval(async () => {
  const monitoringResults = await Promise.all([
    orchestrator.monitorArtifact('component-template-v1', './templates/component.njk'),
    orchestrator.monitorArtifact('data-model-v1', './models/data.json')
  ]);
  
  monitoringResults.forEach(result => {
    if (result.hasDrift && result.significance > 0.5) {
      console.log(`Critical drift detected in ${result.artifactId}:`, result);
    }
  });
}, 60000); // Check every minute
```

### Error Handling and Recovery

```javascript
async function robustArtifactProcessing(artifactPath) {
  const orchestrator = new KGenAgentOrchestrator();
  
  try {
    await orchestrator.initializeAgents();
    const result = await orchestrator.processArtifact(artifactPath);
    
    if (!result.success) {
      // Attempt recovery procedures
      console.log(`Processing failed for ${artifactPath}:`, result.error);
      
      // Check if it's a retryable error
      if (result.error.includes('TIMEOUT') || result.error.includes('BUSY')) {
        console.log('Retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return orchestrator.processArtifact(artifactPath);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Fatal error in artifact processing:', error);
    
    // Generate diagnostic report
    const status = await orchestrator.getSystemStatus();
    console.log('System status at time of error:', status);
    
    throw error;
  }
}
```

This integration guide provides a comprehensive foundation for autonomous agents to effectively utilize KGEN resolver systems with proper error handling, performance monitoring, and recovery procedures.