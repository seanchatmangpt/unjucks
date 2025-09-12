/**
 * Git-First Provenance System for KGEN
 * 
 * Replaces file-based .attest.json with git-notes provenance storage.
 * Implements PROV-O compliant provenance tracking using git infrastructure.
 */

import { GitOperations } from './git-operations.js';
import crypto from 'crypto';
import path from 'path';

export class GitProvenanceTracker {
  constructor(options = {}) {
    this.gitOps = new GitOperations(options);
    this.provenanceNamespace = options.provenanceNamespace || 'http://kgen.org/prov#';
    this.enableContentAddressing = options.enableContentAddressing !== false;
    this.forceGitNotes = options.forceGitNotes !== false;
    
    // PROV-O vocabulary
    this.provVocab = {
      ACTIVITY: 'prov:Activity',
      ENTITY: 'prov:Entity', 
      AGENT: 'prov:Agent',
      USED: 'prov:used',
      GENERATED: 'prov:wasGeneratedBy',
      ASSOCIATED_WITH: 'prov:wasAssociatedWith',
      STARTED_AT: 'prov:startedAtTime',
      ENDED_AT: 'prov:endedAtTime'
    };
  }

  /**
   * Initialize git-first provenance system
   */
  async initialize() {
    const gitResult = await this.gitOps.initialize();
    
    return {
      success: true,
      gitFirst: true,
      ...gitResult,
      provenanceStorage: 'git-notes',
      contentAddressing: this.enableContentAddressing
    };
  }

  /**
   * Track artifact generation with git-first provenance
   */
  async trackGeneration(generationData) {
    try {
      const {
        templatePath,
        templateContent,
        contextData,
        outputContent,
        outputPath,
        metadata = {}
      } = generationData;

      // Create git blobs for all components
      const templateBlob = await this.gitOps.createBlob(templateContent);
      const contextBlob = await this.gitOps.createBlob(JSON.stringify(contextData, null, 2));
      const outputBlob = await this.gitOps.createBlob(outputContent);

      // Generate deterministic activity ID
      const activityId = this._generateActivityId(templateBlob.sha, contextBlob.sha);

      // Create PROV-O compliant provenance record
      const provenanceRecord = {
        '@context': {
          'prov': 'http://www.w3.org/ns/prov#',
          'kgen': this.provenanceNamespace,
          'xsd': 'http://www.w3.org/2001/XMLSchema#'
        },
        '@id': `kgen:activity-${activityId}`,
        '@type': this.provVocab.ACTIVITY,
        
        // Core PROV-O properties
        [this.provVocab.USED]: [
          {
            '@id': `kgen:template-${templateBlob.sha}`,
            '@type': this.provVocab.ENTITY,
            'kgen:blobSha': templateBlob.sha,
            'kgen:path': templatePath,
            'kgen:role': 'template',
            'kgen:contentType': 'text/plain'
          },
          {
            '@id': `kgen:context-${contextBlob.sha}`,
            '@type': this.provVocab.ENTITY,
            'kgen:blobSha': contextBlob.sha,
            'kgen:role': 'context',
            'kgen:contentType': 'application/json'
          }
        ],
        
        [this.provVocab.GENERATED]: {
          '@id': `kgen:artifact-${outputBlob.sha}`,
          '@type': this.provVocab.ENTITY,
          'kgen:blobSha': outputBlob.sha,
          'kgen:path': outputPath,
          'kgen:contentType': metadata.contentType || 'application/octet-stream',
          'kgen:size': outputBlob.size
        },
        
        [this.provVocab.ASSOCIATED_WITH]: {
          '@id': 'kgen:agent-system',
          '@type': this.provVocab.AGENT,
          'kgen:name': 'KGEN GitFirst Engine',
          'kgen:version': metadata.version || '1.0.0',
          'kgen:gitCommit': await this._getCurrentCommitSha()
        },
        
        [this.provVocab.STARTED_AT]: {
          '@type': 'xsd:dateTime',
          '@value': metadata.startTime || this.getDeterministicDate().toISOString()
        },
        
        [this.provVocab.ENDED_AT]: {
          '@type': 'xsd:dateTime',
          '@value': this.getDeterministicDate().toISOString()
        },
        
        // KGEN-specific extensions
        'kgen:deterministicGeneration': true,
        'kgen:contentAddressing': this.enableContentAddressing,
        'kgen:reproductionContext': {
          'kgen:nodeVersion': process.version,
          'kgen:platform': process.platform,
          'kgen:arch': process.arch,
          'kgen:gitFirst': true
        },
        
        // Integrity verification
        'kgen:integrity': {
          'kgen:templateHash': templateBlob.sha,
          'kgen:contextHash': contextBlob.sha,
          'kgen:outputHash': outputBlob.sha,
          'kgen:chainHash': this._calculateChainHash([
            templateBlob.sha,
            contextBlob.sha,
            outputBlob.sha
          ])
        }
      };

      // Store provenance in git notes
      await this.gitOps.storeProvenance(outputBlob.sha, provenanceRecord);

      return {
        success: true,
        activityId,
        outputSha: outputBlob.sha,
        templateSha: templateBlob.sha,
        contextSha: contextBlob.sha,
        provenanceStored: true,
        gitNotes: true,
        contentAddressing: this.enableContentAddressing
      };

    } catch (error) {
      throw new Error(`Git provenance tracking failed: ${error.message}`);
    }
  }

  /**
   * Retrieve provenance for artifact by git SHA
   */
  async getArtifactProvenance(artifactSha) {
    try {
      const provenanceData = await this.gitOps.getProvenance(artifactSha);
      
      if (!provenanceData) {
        return {
          found: false,
          artifactSha,
          reason: 'No provenance data found in git notes'
        };
      }

      // Validate provenance structure
      const validation = this._validateProvenanceRecord(provenanceData.provenance);

      return {
        found: true,
        artifactSha,
        provenance: provenanceData.provenance,
        validation,
        source: 'git-notes',
        notesRef: provenanceData.notesRef
      };

    } catch (error) {
      throw new Error(`Failed to retrieve provenance for ${artifactSha}: ${error.message}`);
    }
  }

  /**
   * Verify artifact integrity using git-based provenance
   */
  async verifyArtifactIntegrity(artifactSha, options = {}) {
    try {
      const provenanceData = await this.getArtifactProvenance(artifactSha);
      
      if (!provenanceData.found) {
        return {
          verified: false,
          reason: 'No provenance data available',
          artifactSha
        };
      }

      const prov = provenanceData.provenance;
      
      // Verify blob still exists in git
      const blobExists = await this._verifyBlobExists(artifactSha);
      if (!blobExists) {
        return {
          verified: false,
          reason: 'Artifact blob not found in git repository',
          artifactSha
        };
      }

      // Verify integrity chain if present
      let integrityVerified = true;
      let integrityDetails = {};
      
      if (prov['kgen:integrity']) {
        integrityDetails = await this._verifyIntegrityChain(prov['kgen:integrity']);
        integrityVerified = integrityDetails.verified;
      }

      // Check reproducibility if requested
      let reproducibilityCheck = null;
      if (options.checkReproducibility && prov['kgen:reproductionContext']) {
        reproducibilityCheck = await this._checkReproducibility(prov);
      }

      return {
        verified: blobExists && integrityVerified,
        artifactSha,
        blobExists,
        integrityVerified,
        integrityDetails,
        reproducibilityCheck,
        provenance: provenanceData.provenance,
        source: 'git-notes'
      };

    } catch (error) {
      throw new Error(`Integrity verification failed for ${artifactSha}: ${error.message}`);
    }
  }

  /**
   * Generate compliance report using git-based provenance
   */
  async generateComplianceReport(criteria = {}) {
    try {
      const report = {
        timestamp: this.getDeterministicDate().toISOString(),
        criteria,
        gitFirst: true,
        storage: 'git-notes',
        compliance: {
          totalArtifacts: 0,
          trackedArtifacts: 0,
          verifiedArtifacts: 0,
          missingProvenance: [],
          failedVerification: []
        }
      };

      // Get all tracked blobs (simplified - in real implementation would scan git notes)
      const trackedBlobs = await this._getAllTrackedBlobs();
      report.compliance.totalArtifacts = trackedBlobs.length;

      for (const blobSha of trackedBlobs) {
        try {
          const provenanceData = await this.getArtifactProvenance(blobSha);
          
          if (provenanceData.found) {
            report.compliance.trackedArtifacts++;
            
            const verification = await this.verifyArtifactIntegrity(blobSha);
            if (verification.verified) {
              report.compliance.verifiedArtifacts++;
            } else {
              report.compliance.failedVerification.push({
                sha: blobSha,
                reason: verification.reason
              });
            }
          } else {
            report.compliance.missingProvenance.push(blobSha);
          }
        } catch (error) {
          report.compliance.failedVerification.push({
            sha: blobSha,
            error: error.message
          });
        }
      }

      return report;

    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error.message}`);
    }
  }

  /**
   * Export provenance data to external format (maintaining git-first approach)
   */
  async exportProvenance(artifactSha, format = 'json-ld') {
    try {
      const provenanceData = await this.getArtifactProvenance(artifactSha);
      
      if (!provenanceData.found) {
        throw new Error(`No provenance found for artifact ${artifactSha}`);
      }

      const exported = {
        format,
        exported: this.getDeterministicDate().toISOString(),
        artifactSha,
        source: 'git-notes',
        gitFirst: true,
        data: provenanceData.provenance
      };

      if (format === 'turtle') {
        // Convert JSON-LD to Turtle (simplified implementation)
        exported.turtle = this._jsonLdToTurtle(provenanceData.provenance);
      }

      return exported;

    } catch (error) {
      throw new Error(`Provenance export failed for ${artifactSha}: ${error.message}`);
    }
  }

  /**
   * Generate deterministic activity ID from input hashes
   */
  _generateActivityId(templateSha, contextSha) {
    const combined = `${templateSha}:${contextSha}`;
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  /**
   * Calculate integrity chain hash
   */
  _calculateChainHash(shas) {
    const combined = shas.sort().join(':');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get current git commit SHA
   */
  async _getCurrentCommitSha() {
    try {
      return await this.gitOps.simpleGit.revparse(['HEAD']);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Verify git blob exists
   */
  async _verifyBlobExists(blobSha) {
    try {
      await this.gitOps.readBlob(blobSha);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify integrity chain
   */
  async _verifyIntegrityChain(integrityData) {
    try {
      const { templateHash, contextHash, outputHash, chainHash } = integrityData;
      
      // Recalculate chain hash
      const recalculatedChainHash = this._calculateChainHash([
        templateHash,
        contextHash,
        outputHash
      ]);

      return {
        verified: chainHash === recalculatedChainHash,
        original: chainHash,
        recalculated: recalculatedChainHash,
        components: {
          template: await this._verifyBlobExists(templateHash),
          context: await this._verifyBlobExists(contextHash),
          output: await this._verifyBlobExists(outputHash)
        }
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Check artifact reproducibility
   */
  async _checkReproducibility(provenanceRecord) {
    // Simplified reproducibility check
    const context = provenanceRecord['kgen:reproductionContext'];
    
    return {
      nodeVersion: {
        original: context['kgen:nodeVersion'],
        current: process.version,
        compatible: context['kgen:nodeVersion'] === process.version
      },
      platform: {
        original: context['kgen:platform'],
        current: process.platform,
        compatible: context['kgen:platform'] === process.platform
      },
      gitFirst: context['kgen:gitFirst'] === true,
      overall: context['kgen:nodeVersion'] === process.version && 
               context['kgen:platform'] === process.platform &&
               context['kgen:gitFirst'] === true
    };
  }

  /**
   * Validate PROV-O compliant provenance record
   */
  _validateProvenanceRecord(provRecord) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check required PROV-O elements
    if (!provRecord['@context']) {
      validation.errors.push('Missing @context');
    }
    
    if (!provRecord['@type']) {
      validation.errors.push('Missing @type');
    }

    if (!provRecord[this.provVocab.USED]) {
      validation.warnings.push('No prov:used relationships');
    }

    if (!provRecord[this.provVocab.GENERATED]) {
      validation.warnings.push('No prov:wasGeneratedBy relationships');
    }

    validation.valid = validation.errors.length === 0;
    
    return validation;
  }

  /**
   * Get all tracked blobs (placeholder - would scan git notes)
   */
  async _getAllTrackedBlobs() {
    // Simplified implementation - would scan git notes ref for all tracked blobs
    try {
      const notes = await this.gitOps.simpleGit.raw([
        'notes', 
        '--ref', this.gitOps.notesRef,
        'list'
      ]);
      
      return notes.trim().split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      return [];
    }
  }

  /**
   * Convert JSON-LD to Turtle (simplified)
   */
  _jsonLdToTurtle(jsonLd) {
    // Simplified Turtle serialization
    let turtle = '';
    
    if (jsonLd['@context']) {
      for (const [prefix, uri] of Object.entries(jsonLd['@context'])) {
        if (typeof uri === 'string') {
          turtle += `@prefix ${prefix}: <${uri}> .\n`;
        }
      }
      turtle += '\n';
    }

    turtle += `<${jsonLd['@id']}> a ${jsonLd['@type']} .\n`;
    
    return turtle;
  }
}

export default GitProvenanceTracker;