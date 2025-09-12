/**
 * Git Integration for KGEN Provenance System
 * 
 * Integrates git:// URI resolution with provenance tracking and attestation:
 * - Links git URI resolver with provenance system
 * - Handles attestation attachment and retrieval
 * - Supports content-addressable artifact resolution
 */

import { GitUriResolver } from '../resolvers/git-uri-resolver.js';
import { GitProvenanceTracker } from '../git/git-provenance.js';
import { GitOperations } from '../git/git-operations.js';
import crypto from 'crypto';
import path from 'path';

export class GitProvenanceIntegration {
  constructor(options = {}) {
    this.options = {
      enableUriResolution: options.enableUriResolution !== false,
      enableAttestations: options.enableAttestations !== false,
      autoTrackGeneration: options.autoTrackGeneration !== false,
      ...options
    };
    
    this.gitUriResolver = new GitUriResolver(options);
    this.provenanceTracker = new GitProvenanceTracker(options);
    this.gitOps = new GitOperations(options);
  }

  /**
   * Initialize integrated git provenance system
   */
  async initialize() {
    const resolverResult = await this.gitUriResolver.initialize();
    const provenanceResult = await this.provenanceTracker.initialize();
    
    return {
      success: true,
      gitIntegration: true,
      resolver: resolverResult,
      provenance: provenanceResult,
      features: {
        uriResolution: this.options.enableUriResolution,
        attestations: this.options.enableAttestations,
        autoTracking: this.options.autoTrackGeneration
      }
    };
  }

  /**
   * Resolve git URI with provenance tracking
   */
  async resolveWithProvenance(uri, options = {}) {
    try {
      // Resolve the URI
      const resolveResult = await this.gitUriResolver.resolve(uri);
      
      // Track resolution activity if enabled
      if (this.options.autoTrackGeneration) {
        const resolutionActivity = await this._trackResolutionActivity(uri, resolveResult, options);
        resolveResult.provenanceActivity = resolutionActivity;
      }
      
      // Get existing provenance for the resolved object
      if (resolveResult.sha) {
        const existingProvenance = await this.provenanceTracker.getArtifactProvenance(resolveResult.sha);
        if (existingProvenance.found) {
          resolveResult.existingProvenance = existingProvenance;
        }
      }
      
      return {
        ...resolveResult,
        provenanceIntegrated: true,
        uri
      };
    } catch (error) {
      throw new Error(`Failed to resolve git URI with provenance: ${error.message}`);
    }
  }

  /**
   * Generate artifact from git URI with full provenance tracking
   */
  async generateFromGitUri(templateUri, contextData, outputPath, options = {}) {
    try {
      // Resolve template from git URI
      const templateResult = await this.resolveWithProvenance(templateUri);
      
      if (templateResult.type !== 'file' && templateResult.type !== 'blob') {
        throw new Error(`Git URI must resolve to file content for generation: ${templateUri}`);
      }
      
      // Generate artifact using template content
      const generation = await this._generateArtifactFromContent(
        templateResult.content,
        contextData,
        outputPath,
        {
          ...options,
          templateUri,
          templateSha: templateResult.sha,
          templateProvenance: templateResult.existingProvenance
        }
      );
      
      return {
        success: true,
        gitUriGeneration: true,
        templateUri,
        template: templateResult,
        generation,
        provenance: generation.provenance,
        outputPath
      };
    } catch (error) {
      throw new Error(`Failed to generate from git URI: ${error.message}`);
    }
  }

  /**
   * Attach attestation to git object with provenance integration
   */
  async attachAttestationWithProvenance(objectSha, attestationData, options = {}) {
    try {
      // Create enhanced attestation with provenance context
      const enhancedAttestation = {
        ...attestationData,
        provenanceContext: {
          attachedAt: this.getDeterministicDate().toISOString(),
          attachedBy: options.attestor || 'kgen-system',
          provenanceSystem: 'kgen-git-integration',
          version: options.version || '1.0.0'
        },
        integrity: {
          objectSha,
          attestationHash: this._calculateAttestationHash(attestationData)
        }
      };
      
      // Attach via git URI resolver
      const attachResult = await this.gitUriResolver.attachAttestation(objectSha, enhancedAttestation);
      
      // Track attestation activity
      if (this.options.autoTrackGeneration) {
        const attestationActivity = await this._trackAttestationActivity(
          objectSha, 
          enhancedAttestation, 
          options
        );
        attachResult.provenanceActivity = attestationActivity;
      }
      
      return {
        ...attachResult,
        provenanceIntegrated: true,
        enhancedAttestation: true
      };
    } catch (error) {
      throw new Error(`Failed to attach attestation with provenance: ${error.message}`);
    }
  }

  /**
   * Retrieve comprehensive artifact information by git URI or SHA
   */
  async getArtifactInfo(identifier, options = {}) {
    try {
      let artifactSha = identifier;
      let uriResult = null;
      
      // If identifier is a git URI, resolve it first
      if (identifier.startsWith('git://')) {
        uriResult = await this.resolveWithProvenance(identifier);
        artifactSha = uriResult.sha;
      }
      
      // Get provenance data
      const provenanceData = await this.provenanceTracker.getArtifactProvenance(artifactSha);
      
      // Get attestations
      const attestations = await this.gitUriResolver.getAttestations(artifactSha);
      
      // Verify integrity if requested
      let integrity = null;
      if (options.verifyIntegrity) {
        integrity = await this.provenanceTracker.verifyArtifactIntegrity(artifactSha, {
          checkReproducibility: options.checkReproducibility
        });
      }
      
      return {
        identifier,
        artifactSha,
        uri: uriResult,
        provenance: provenanceData,
        attestations,
        integrity,
        comprehensive: true
      };
    } catch (error) {
      throw new Error(`Failed to get artifact info: ${error.message}`);
    }
  }

  /**
   * Create git URI for artifact with automatic provenance lookup
   */
  async createUriForArtifact(artifactSha, options = {}) {
    try {
      // Get provenance data to find repository context
      const provenanceData = await this.provenanceTracker.getArtifactProvenance(artifactSha);
      
      let repositoryDir = options.repository || process.cwd();
      
      if (provenanceData.found) {
        // Extract repository information from provenance if available
        const prov = provenanceData.provenance;
        if (prov['kgen:reproductionContext']) {
          repositoryDir = prov['kgen:reproductionContext']['kgen:repository'] || repositoryDir;
        }
      }
      
      // Create git URI
      const gitUri = this.gitUriResolver.createGitUri(
        path.basename(repositoryDir),
        artifactSha,
        options.filepath
      );
      
      return {
        gitUri,
        artifactSha,
        repository: repositoryDir,
        provenance: provenanceData.found,
        created: true
      };
    } catch (error) {
      throw new Error(`Failed to create git URI for artifact: ${error.message}`);
    }
  }

  /**
   * Generate compliance report with git URI integration
   */
  async generateIntegratedComplianceReport(criteria = {}) {
    try {
      const baseReport = await this.provenanceTracker.generateComplianceReport(criteria);
      
      // Enhanced report with git URI capabilities
      const enhancedReport = {
        ...baseReport,
        gitIntegration: {
          uriResolutionEnabled: this.options.enableUriResolution,
          attestationsEnabled: this.options.enableAttestations,
          autoTrackingEnabled: this.options.autoTrackGeneration
        },
        resolverStats: this.gitUriResolver.getStats(),
        gitOperationsStats: this.gitOps.getPerformanceStats()
      };
      
      return enhancedReport;
    } catch (error) {
      throw new Error(`Failed to generate integrated compliance report: ${error.message}`);
    }
  }

  /**
   * Track resolution activity in provenance system
   */
  async _trackResolutionActivity(uri, resolveResult, options) {
    try {
      const activityId = this._generateActivityId('resolve', uri);
      
      const activity = {
        '@context': 'http://www.w3.org/ns/prov#',
        '@id': `kgen:resolution-${activityId}`,
        '@type': 'prov:Activity',
        'prov:used': {
          '@type': 'prov:Entity',
          'kgen:gitUri': uri,
          'kgen:resolvedSha': resolveResult.sha,
          'kgen:resolvedType': resolveResult.type
        },
        'prov:wasAssociatedWith': {
          '@type': 'prov:Agent',
          'kgen:agent': 'GitUriResolver',
          'kgen:version': '1.0.0'
        },
        'prov:startedAtTime': this.getDeterministicDate().toISOString(),
        'kgen:resolutionContext': {
          uri,
          cached: resolveResult.cached || false,
          ...options
        }
      };
      
      // Store activity as provenance note on resolved object
      if (resolveResult.sha) {
        await this.gitOps.storeProvenance(resolveResult.sha, activity);
      }
      
      return activity;
    } catch (error) {
      console.warn(`Failed to track resolution activity: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate artifact from template content with provenance
   */
  async _generateArtifactFromContent(templateContent, contextData, outputPath, options) {
    try {
      // Use existing provenance tracking for generation
      const generationData = {
        templatePath: options.templateUri,
        templateContent,
        contextData,
        outputContent: this._renderTemplate(templateContent, contextData),
        outputPath,
        metadata: {
          templateUri: options.templateUri,
          templateSha: options.templateSha,
          generatedVia: 'git-uri-resolution',
          ...options
        }
      };
      
      const provenanceResult = await this.provenanceTracker.trackGeneration(generationData);
      
      // Create output blob
      const outputBlob = await this.gitOps.createBlob(generationData.outputContent);
      
      return {
        success: true,
        outputSha: outputBlob.sha,
        content: generationData.outputContent,
        provenance: provenanceResult,
        gitIntegrated: true
      };
    } catch (error) {
      throw new Error(`Failed to generate artifact from content: ${error.message}`);
    }
  }

  /**
   * Track attestation activity
   */
  async _trackAttestationActivity(objectSha, attestationData, options) {
    try {
      const activityId = this._generateActivityId('attest', objectSha);
      
      const activity = {
        '@context': 'http://www.w3.org/ns/prov#',
        '@id': `kgen:attestation-${activityId}`,
        '@type': 'prov:Activity',
        'prov:used': {
          '@type': 'prov:Entity',
          'kgen:objectSha': objectSha,
          'kgen:attestationType': attestationData['@type'] || 'Attestation'
        },
        'prov:wasAssociatedWith': {
          '@type': 'prov:Agent',
          'kgen:attestor': options.attestor || 'kgen-system'
        },
        'prov:startedAtTime': this.getDeterministicDate().toISOString(),
        'kgen:attestationActivity': true
      };
      
      return activity;
    } catch (error) {
      console.warn(`Failed to track attestation activity: ${error.message}`);
      return null;
    }
  }

  /**
   * Simple template rendering
   */
  _renderTemplate(template, context) {
    let content = template;
    
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
    
    return content;
  }

  /**
   * Generate activity ID
   */
  _generateActivityId(type, data) {
    const combined = `${type}:${data}:${this.getDeterministicTimestamp()}`;
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 12);
  }

  /**
   * Calculate attestation hash
   */
  _calculateAttestationHash(attestation) {
    const canonicalData = JSON.stringify(attestation, Object.keys(attestation).sort());
    return crypto.createHash('sha256').update(canonicalData).digest('hex');
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats() {
    return {
      integration: {
        type: 'git-provenance-integration',
        features: {
          uriResolution: this.options.enableUriResolution,
          attestations: this.options.enableAttestations,
          autoTracking: this.options.autoTrackGeneration
        }
      },
      resolver: this.gitUriResolver.getStats(),
      git: this.gitOps.getPerformanceStats()
    };
  }
}

export default GitProvenanceIntegration;