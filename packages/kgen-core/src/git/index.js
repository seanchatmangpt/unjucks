/**
 * Git-First Module for KGEN - Main Entry Point
 * 
 * Exports git-first workflow components for:
 * - Blob-based content addressing
 * - Git notes provenance storage
 * - Git URI resolution and attestation
 * - Packfile handling for reproducibility
 * - Windows FS performance optimizations
 */

import { GitOperations } from './git-operations.js';
import { GitProvenanceTracker } from './git-provenance.js';
import { GitUriResolver } from '../resolvers/git-uri-resolver.js';
import { GitProvenanceIntegration } from '../provenance/git-integration.js';

export { GitOperations } from './git-operations.js';
export { GitProvenanceTracker } from './git-provenance.js';
export { GitUriResolver } from '../resolvers/git-uri-resolver.js';
export { GitProvenanceIntegration } from '../provenance/git-integration.js';

/**
 * Create a git-first workflow instance with integrated operations and provenance
 * @param {Object} options - Configuration options
 * @returns {Object} Git-first workflow instance
 */
export function createGitFirstWorkflow(options = {}) {
  const gitOps = new GitOperations(options);
  const provenance = new GitProvenanceTracker(options);
  const integration = new GitProvenanceIntegration(options);
  
  return {
    gitOps,
    provenance,
    integration,
    
    /**
     * Initialize complete git-first workflow
     */
    async initialize() {
      const gitResult = await gitOps.initialize();
      const provResult = await provenance.initialize();
      const integrationResult = await integration.initialize();
      
      return {
        success: gitResult.success && provResult.success && integrationResult.success,
        gitFirst: true,
        git: gitResult,
        provenance: provResult,
        integration: integrationResult
      };
    },

    /**
     * Generate artifact using git-first approach
     */
    async generateArtifact(templatePath, context, outputPath, options = {}) {
      try {
        // Read template content
        const fs = await import('fs-extra');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Generate using git operations
        const artifact = await gitOps.generateGitArtifact(templatePath, context, {
          ...options,
          outputPath
        });
        
        // Track generation with git-based provenance
        const provenanceResult = await provenance.trackGeneration({
          templatePath,
          templateContent,
          contextData: context,
          outputContent: artifact.content,
          outputPath,
          metadata: {
            version: options.version || '1.0.0',
            startTime: this.getDeterministicDate().toISOString(),
            contentType: options.contentType
          }
        });
        
        // Write blob to filesystem if requested
        let fileResult = null;
        if (outputPath) {
          fileResult = await gitOps.writeBlobToFile(artifact.artifactSha, outputPath);
        }
        
        return {
          success: true,
          gitFirst: true,
          artifact: {
            sha: artifact.artifactSha,
            content: artifact.content,
            templateSha: artifact.templateSha,
            contextSha: artifact.contextSha
          },
          provenance: provenanceResult,
          file: fileResult,
          contentAddressing: true
        };
        
      } catch (error) {
        throw new Error(`Git-first artifact generation failed: ${error.message}`);
      }
    },

    /**
     * Verify artifact using git-first approach
     */
    async verifyArtifact(artifactShaOrPath) {
      try {
        let artifactSha = artifactShaOrPath;
        
        // If path provided, derive SHA from .sha file
        if (artifactShaOrPath.includes('/') || artifactShaOrPath.includes('\\')) {
          const fs = await import('fs-extra');
          const path = await import('path');
          
          const shaPath = path.join(
            path.dirname(artifactShaOrPath), 
            `${path.basename(artifactShaOrPath, path.extname(artifactShaOrPath))}.sha`
          );
          
          if (await fs.pathExists(shaPath)) {
            const shaData = JSON.parse(await fs.readFile(shaPath, 'utf8'));
            artifactSha = shaData.sha;
          } else {
            throw new Error(`Cannot determine SHA for path: ${artifactShaOrPath}`);
          }
        }
        
        return await provenance.verifyArtifactIntegrity(artifactSha, {
          checkReproducibility: true
        });
        
      } catch (error) {
        throw new Error(`Git-first artifact verification failed: ${error.message}`);
      }
    },

    /**
     * Export provenance data
     */
    async exportProvenance(artifactSha, format = 'json-ld') {
      return await provenance.exportProvenance(artifactSha, format);
    },

    /**
     * Generate compliance report
     */
    async generateComplianceReport(criteria = {}) {
      return await provenance.generateComplianceReport(criteria);
    },

    /**
     * Create packfile for distribution
     */
    async createDistributionPackfile(artifacts, outputPath) {
      const objects = Array.isArray(artifacts) ? artifacts : [artifacts];
      return await gitOps.createPackfile(objects, outputPath);
    },

    /**
     * Get semantic diff between artifacts
     */
    async getArtifactDiff(sha1, sha2) {
      return await gitOps.getSemanticDiff(sha1, sha2);
    },

    /**
     * Resolve git URI to artifact content
     */
    async resolveGitUri(uri, options = {}) {
      return await integration.resolveWithProvenance(uri, options);
    },

    /**
     * Generate artifact from git URI template
     */
    async generateFromGitUri(templateUri, contextData, outputPath, options = {}) {
      return await integration.generateFromGitUri(templateUri, contextData, outputPath, options);
    },

    /**
     * Attach attestation to git object
     */
    async attachAttestation(objectSha, attestationData, options = {}) {
      return await integration.attachAttestationWithProvenance(objectSha, attestationData, options);
    },

    /**
     * Get comprehensive artifact information
     */
    async getArtifactInfo(identifier, options = {}) {
      return await integration.getArtifactInfo(identifier, options);
    },

    /**
     * Create git URI for artifact
     */
    async createUriForArtifact(artifactSha, options = {}) {
      return await integration.createUriForArtifact(artifactSha, options);
    },

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
      return {
        git: gitOps.getPerformanceStats(),
        integration: integration.getIntegrationStats(),
        overall: {
          gitFirst: true,
          contentAddressing: options.enableContentAddressing !== false,
          notesStorage: true,
          uriResolution: true
        }
      };
    }
  };
}

/**
 * Create lightweight git-first workflow for development
 */
export function createLightweightGitWorkflow(options = {}) {
  return createGitFirstWorkflow({
    enableContentAddressing: true,
    enableHardlinkCache: false,
    ...options
  });
}

/**
 * Create enterprise git-first workflow with full features
 */
export function createEnterpriseGitWorkflow(options = {}) {
  return createGitFirstWorkflow({
    enableContentAddressing: true,
    enableHardlinkCache: true,
    forceGitNotes: true,
    cacheSize: 10000,
    enableUriResolution: true,
    enableAttestations: true,
    autoTrackGeneration: true,
    allowRemoteRepos: options.allowRemoteRepos !== false,
    ...options
  });
}

/**
 * Create git URI resolver with enterprise configuration
 */
export function createEnterpriseGitUriResolver(options = {}) {
  return new GitUriResolver({
    allowRemoteRepos: true,
    enableAttestation: true,
    cacheSize: 10000,
    cacheMaxAge: 15 * 60 * 1000, // 15 minutes
    enableHardlinkCache: true,
    ...options
  });
}

// Export factory as default
export default createGitFirstWorkflow;