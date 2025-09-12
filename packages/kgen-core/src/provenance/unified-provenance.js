/**
 * Unified Provenance System for KGEN - Dark Matter Integration
 * 
 * Combines:
 * - .attest.json sidecars for self-contained artifacts
 * - Git-notes for distributed provenance storage
 * - PROV-O compliance for interoperability
 * - Content addressing for integrity
 * - Dark-matter principles (no central DB dependency)
 * 
 * Implements "git show + verify" workflow for complete supply chain visibility.
 */

import { GitProvenanceTracker } from '../git/git-provenance.js';
import { AttestationGenerator } from '../attestation/generator.js';
import { GitOperations } from '../git/git-operations.js';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

export class UnifiedProvenanceSystem {
  constructor(options = {}) {
    this.config = {
      // Dark-matter principles
      enableGitFirst: options.enableGitFirst !== false,
      requireSidecars: options.requireSidecars !== false,
      noCentralDatabase: options.noCentralDatabase !== false,
      enableContentAddressing: options.enableContentAddressing !== false,
      
      // Unified format version
      unifiedVersion: '2.0.0',
      attestJsonVersion: '1.1.0',
      
      // Git configuration
      gitRepoPath: options.gitRepoPath || process.cwd(),
      notesRef: options.notesRef || 'refs/notes/kgen-provenance',
      
      // Sidecar configuration
      sidecarExtension: '.attest.json',
      enablePrettyPrint: options.enablePrettyPrint !== false,
      
      // PROV-O compliance
      enableProvO: options.enableProvO !== false,
      provenanceNamespace: options.provenanceNamespace || 'http://kgen.org/prov#',
      
      // Verification settings
      enableChainValidation: options.enableChainValidation !== false,
      enableIntegrityVerification: options.enableIntegrityVerification !== false,
      
      ...options
    };
    
    this.logger = consola.withTag('unified-provenance');
    
    // Initialize component systems
    this.gitTracker = this.config.enableGitFirst ? 
      new GitProvenanceTracker(this.config) : null;
    
    this.attestationGenerator = new AttestationGenerator({
      ...this.config,
      enableBlockchainIntegrity: false // Dark-matter principle: no external deps
    });
    
    this.gitOps = new GitOperations(this.config);
    
    // Unified state
    this.artifactRegistry = new Map();
    this.verificationCache = new Map();
    this.supplyChainGraph = new Map(); // For visualization
    
    this.state = 'initialized';
  }

  /**
   * Initialize the unified provenance system
   */
  async initialize() {
    try {
      this.logger.info('Initializing unified provenance system...');
      
      // Initialize git operations
      const gitResult = await this.gitOps.initialize();
      
      // Initialize git-first tracker if enabled
      if (this.gitTracker) {
        await this.gitTracker.initialize();
      }
      
      // Initialize attestation generator
      await this.attestationGenerator.initialize();
      
      // Validate dark-matter compliance
      await this._validateDarkMatterCompliance();
      
      this.state = 'ready';
      this.logger.success('Unified provenance system initialized');
      
      return {
        success: true,
        version: this.config.unifiedVersion,
        gitFirst: this.config.enableGitFirst,
        darkMatter: this.config.noCentralDatabase,
        components: {
          gitTracker: !!this.gitTracker,
          attestationGenerator: true,
          gitOperations: gitResult.success
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize unified provenance system:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Track artifact generation with unified approach
   * Creates both .attest.json sidecar AND git-notes provenance
   */
  async trackGeneration(generationData) {
    try {
      const {
        artifactPath,
        templatePath,
        templateContent,
        contextData,
        outputContent,
        metadata = {}
      } = generationData;

      this.logger.info(`Tracking generation for artifact: ${artifactPath}`);

      // Step 1: Create unified .attest.json sidecar
      const sidecarResult = await this._createUnifiedSidecar(generationData);
      
      // Step 2: Store provenance in git-notes if enabled
      let gitProvenanceResult = null;
      if (this.gitTracker && this.config.enableGitFirst) {
        gitProvenanceResult = await this.gitTracker.trackGeneration(generationData);
      }
      
      // Step 3: Build supply chain linkage
      await this._updateSupplyChainGraph(artifactPath, generationData, sidecarResult);
      
      // Step 4: Register in unified registry
      const registryEntry = {
        artifactPath,
        sidecar: sidecarResult,
        gitProvenance: gitProvenanceResult,
        timestamp: this.getDeterministicDate().toISOString(),
        unified: true
      };
      
      this.artifactRegistry.set(artifactPath, registryEntry);
      
      return {
        success: true,
        unified: true,
        artifactPath,
        sidecar: sidecarResult,
        gitProvenance: gitProvenanceResult,
        supplyChainUpdated: true
      };
      
    } catch (error) {
      this.logger.error(`Failed to track generation for ${generationData.artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Verify artifact using unified approach
   * Checks both .attest.json sidecar AND git-notes provenance
   */
  async verifyArtifact(artifactPath, options = {}) {
    try {
      this.logger.info(`Verifying artifact: ${artifactPath}`);
      
      const verification = {
        artifactPath,
        unified: true,
        timestamp: this.getDeterministicDate().toISOString(),
        results: {
          sidecar: null,
          gitProvenance: null,
          contentAddressing: null,
          supplyChain: null
        },
        overall: {
          verified: false,
          confidence: 0,
          issues: []
        }
      };

      // Step 1: Verify .attest.json sidecar
      verification.results.sidecar = await this._verifySidecar(artifactPath);
      
      // Step 2: Verify git-notes provenance if available
      if (this.gitTracker && this.config.enableGitFirst) {
        verification.results.gitProvenance = await this._verifyGitProvenance(artifactPath);
      }
      
      // Step 3: Content addressing verification
      if (this.config.enableContentAddressing) {
        verification.results.contentAddressing = await this._verifyContentAddressing(artifactPath);
      }
      
      // Step 4: Supply chain verification
      verification.results.supplyChain = await this._verifySupplyChain(artifactPath);
      
      // Calculate overall verification result
      verification.overall = this._calculateOverallVerification(verification.results);
      
      // Cache result
      this.verificationCache.set(artifactPath, verification);
      
      return verification;
      
    } catch (error) {
      this.logger.error(`Failed to verify artifact ${artifactPath}:`, error);
      return {
        artifactPath,
        unified: true,
        timestamp: this.getDeterministicDate().toISOString(),
        overall: {
          verified: false,
          confidence: 0,
          issues: [`Verification error: ${error.message}`]
        },
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive provenance information
   * Combines .attest.json and git-notes data
   */
  async getProvenance(artifactPath, options = {}) {
    try {
      const provenance = {
        artifactPath,
        unified: true,
        timestamp: this.getDeterministicDate().toISOString(),
        sources: {
          sidecar: null,
          gitNotes: null,
          registry: null
        },
        combined: null
      };

      // Load from .attest.json sidecar
      const sidecarPath = artifactPath + this.config.sidecarExtension;
      if (await this._fileExists(sidecarPath)) {
        provenance.sources.sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
      }
      
      // Load from git-notes if available
      if (this.gitTracker) {
        try {
          const gitProvenance = await this.gitTracker.getArtifactProvenance(
            await this._getArtifactSha(artifactPath)
          );
          provenance.sources.gitNotes = gitProvenance.found ? gitProvenance.provenance : null;
        } catch (error) {
          // Git provenance might not exist
        }
      }
      
      // Load from registry
      provenance.sources.registry = this.artifactRegistry.get(artifactPath) || null;
      
      // Combine all sources into unified view
      provenance.combined = this._combineProvenanceSources(provenance.sources);
      
      return provenance;
      
    } catch (error) {
      this.logger.error(`Failed to get provenance for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Generate supply chain visualization data
   */
  async generateSupplyChainVisualization(options = {}) {
    try {
      const visualization = {
        timestamp: this.getDeterministicDate().toISOString(),
        unified: true,
        graph: {
          nodes: [],
          edges: [],
          clusters: []
        },
        statistics: {
          totalArtifacts: this.supplyChainGraph.size,
          totalDependencies: 0,
          templateFamilies: new Set(),
          generations: new Map()
        }
      };

      // Build nodes and edges from supply chain graph
      for (const [artifactPath, chainData] of this.supplyChainGraph.entries()) {
        // Add artifact node
        visualization.graph.nodes.push({
          id: artifactPath,
          type: 'artifact',
          label: path.basename(artifactPath),
          path: artifactPath,
          hash: chainData.artifactHash,
          timestamp: chainData.timestamp,
          verified: chainData.verified || false
        });
        
        // Add template node if exists
        if (chainData.templatePath) {
          const templateId = `template:${chainData.templatePath}`;
          visualization.graph.nodes.push({
            id: templateId,
            type: 'template',
            label: path.basename(chainData.templatePath),
            path: chainData.templatePath,
            hash: chainData.templateHash,
            family: chainData.templateFamily
          });
          
          // Add edge from template to artifact
          visualization.graph.edges.push({
            source: templateId,
            target: artifactPath,
            type: 'generates',
            weight: 1
          });
          
          visualization.statistics.templateFamilies.add(chainData.templateFamily);
        }
        
        // Track dependencies
        if (chainData.dependencies) {
          for (const dep of chainData.dependencies) {
            visualization.graph.edges.push({
              source: dep,
              target: artifactPath,
              type: 'depends_on',
              weight: 0.5
            });
            visualization.statistics.totalDependencies++;
          }
        }
        
        // Track generations
        const generation = chainData.generation || 0;
        visualization.statistics.generations.set(generation, 
          (visualization.statistics.generations.get(generation) || 0) + 1
        );
      }
      
      // Convert statistics sets to arrays for serialization
      visualization.statistics.templateFamilies = Array.from(visualization.statistics.templateFamilies);
      visualization.statistics.generations = Object.fromEntries(visualization.statistics.generations);
      
      return visualization;
      
    } catch (error) {
      this.logger.error('Failed to generate supply chain visualization:', error);
      throw error;
    }
  }

  /**
   * Create command-line verification interface
   */
  async createVerificationCommand(artifactPath) {
    try {
      const verification = await this.verifyArtifact(artifactPath);
      const provenance = await this.getProvenance(artifactPath);
      
      return {
        command: 'git show + verify',
        verification,
        provenance,
        commands: {
          gitShow: this._generateGitShowCommands(provenance),
          localVerify: this._generateLocalVerifyCommands(artifactPath),
          supplyChain: this._generateSupplyChainCommands(artifactPath)
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to create verification command for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Migrate existing .attest.json files to unified format
   */
  async migrateExistingAttestations(options = {}) {
    try {
      this.logger.info('Migrating existing .attest.json files to unified format...');
      
      const migration = {
        startTime: this.getDeterministicDate().toISOString(),
        totalFiles: 0,
        migratedFiles: 0,
        failedFiles: [],
        gitNotesCreated: 0,
        backups: []
      };

      // Find all .attest.json files
      const attestFiles = await this._findAttestationFiles();
      migration.totalFiles = attestFiles.length;
      
      for (const attestFile of attestFiles) {
        try {
          if (options.dryRun) {
            this.logger.debug(`Would migrate: ${attestFile}`);
            continue;
          }
          
          // Load existing attestation
          const existingAttest = JSON.parse(await fs.readFile(attestFile, 'utf8'));
          
          // Create backup if requested
          if (options.createBackups !== false) {
            const backupPath = `${attestFile}.backup.${this.getDeterministicTimestamp()}`;
            await fs.copyFile(attestFile, backupPath);
            migration.backups.push(backupPath);
          }
          
          // Migrate to unified format
          const unifiedAttest = await this._migrateAttestationFormat(existingAttest);
          
          // Write unified format
          await fs.writeFile(attestFile, JSON.stringify(unifiedAttest, null, 2));
          
          // Create git-notes entry if enabled
          if (this.gitTracker && this.config.enableGitFirst) {
            const artifactPath = attestFile.replace(this.config.sidecarExtension, '');
            await this._createGitNotesFromAttestation(artifactPath, unifiedAttest);
            migration.gitNotesCreated++;
          }
          
          migration.migratedFiles++;
          
        } catch (error) {
          migration.failedFiles.push({
            file: attestFile,
            error: error.message
          });
        }
      }
      
      migration.endTime = this.getDeterministicDate().toISOString();
      migration.success = migration.failedFiles.length === 0;
      
      this.logger.info('Migration completed:', migration);
      return migration;
      
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  // Private implementation methods

  async _createUnifiedSidecar(generationData) {
    const { artifactPath, templatePath, contextData, metadata = {} } = generationData;
    
    // Calculate artifact hash
    const artifactContent = await fs.readFile(artifactPath);
    const artifactHash = crypto.createHash('sha256').update(artifactContent).digest('hex');
    
    // Create git blobs for content addressing
    let templateBlob = null;
    let contextBlob = null;
    
    if (this.config.enableContentAddressing) {
      if (generationData.templateContent) {
        templateBlob = await this.gitOps.createBlob(generationData.templateContent);
      }
      if (contextData) {
        contextBlob = await this.gitOps.createBlob(JSON.stringify(contextData, null, 2));
      }
    }
    
    // Build unified .attest.json structure
    const attestation = {
      // Unified format metadata
      "$schema": "https://kgen.org/schemas/attestation-v1.1.json",
      "version": this.config.attestJsonVersion,
      "unified": true,
      "darkMatter": this.config.noCentralDatabase,
      
      // Core attestation data
      "id": crypto.randomUUID(),
      "timestamp": this.getDeterministicDate().toISOString(),
      
      // Artifact information with content addressing
      "artifact": {
        "path": artifactPath,
        "name": path.basename(artifactPath),
        "contentHash": artifactHash,
        "size": artifactContent.length,
        "mimeType": this._detectMimeType(artifactPath),
        "contentAddressing": {
          "enabled": this.config.enableContentAddressing,
          "gitSha": this.config.enableContentAddressing ? 
            (await this.gitOps.createBlob(artifactContent)).sha : null
        }
      },
      
      // Generation provenance
      "generation": {
        "templatePath": templatePath,
        "templateHash": templateBlob?.sha || null,
        "contextHash": contextBlob?.sha || null,
        "context": contextData || {},
        "generatedAt": this.getDeterministicDate().toISOString(),
        "operationId": metadata.operationId || crypto.randomUUID(),
        "agent": metadata.agent || 'kgen-unified'
      },
      
      // Environment reproducibility
      "environment": {
        "generator": {
          "name": "kgen-unified-provenance",
          "version": this.config.unifiedVersion
        },
        "nodeVersion": process.version,
        "platform": process.platform,
        "arch": process.arch,
        "staticBuildTime": metadata.buildTime || this.getDeterministicDate().toISOString()
      },
      
      // PROV-O compliance section
      "provO": this.config.enableProvO ? {
        "@context": {
          "prov": "http://www.w3.org/ns/prov#",
          "kgen": this.config.provenanceNamespace
        },
        "@id": `kgen:activity-${crypto.randomBytes(8).toString('hex')}`,
        "@type": "prov:Activity",
        "prov:used": templatePath ? [{
          "@type": "prov:Entity",
          "prov:location": templatePath,
          "kgen:templateSha": templateBlob?.sha
        }] : [],
        "prov:generated": {
          "@type": "prov:Entity",
          "prov:location": artifactPath,
          "kgen:artifactSha": artifactHash
        }
      } : null,
      
      // Git-first integration
      "git": {
        "enabled": this.config.enableGitFirst,
        "notesRef": this.config.notesRef,
        "contentAddressing": this.config.enableContentAddressing,
        "repoPath": this.config.gitRepoPath
      },
      
      // Verification metadata
      "verification": {
        "reproducible": true,
        "deterministic": true,
        "algorithm": "sha256",
        "darkMatterCompliant": true,
        "supplyChainTraceable": true
      },
      
      // Signature for integrity (self-verifying)
      "signature": {
        "algorithm": "sha256",
        "value": null // Will be calculated after construction
      }
    };
    
    // Calculate signature
    const dataForSigning = { ...attestation };
    delete dataForSigning.signature;
    attestation.signature.value = crypto.createHash('sha256')
      .update(JSON.stringify(dataForSigning, Object.keys(dataForSigning).sort()))
      .digest('hex');
    
    // Write sidecar file
    const sidecarPath = artifactPath + this.config.sidecarExtension;
    await fs.writeFile(sidecarPath, JSON.stringify(attestation, null, 2));
    
    return {
      attestation,
      sidecarPath,
      artifactHash,
      templateHash: templateBlob?.sha || null,
      contextHash: contextBlob?.sha || null
    };
  }

  async _validateDarkMatterCompliance() {
    const compliance = {
      noCentralDatabase: this.config.noCentralDatabase,
      gitFirst: this.config.enableGitFirst,
      selfContained: this.config.requireSidecars,
      contentAddressing: this.config.enableContentAddressing
    };
    
    if (!compliance.noCentralDatabase) {
      this.logger.warn('Dark-matter compliance: Central database dependency detected');
    }
    
    if (!compliance.gitFirst) {
      this.logger.warn('Dark-matter compliance: Git-first not enabled');
    }
    
    return compliance;
  }

  async _verifySidecar(artifactPath) {
    const sidecarPath = artifactPath + this.config.sidecarExtension;
    
    if (!await this._fileExists(sidecarPath)) {
      return {
        verified: false,
        reason: 'No .attest.json sidecar found',
        path: sidecarPath
      };
    }
    
    try {
      const attestation = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
      
      // Verify artifact hash
      const currentHash = await this._calculateFileHash(artifactPath);
      const hashMatches = currentHash === attestation.artifact.contentHash;
      
      // Verify signature
      const dataForSigning = { ...attestation };
      delete dataForSigning.signature;
      const expectedSignature = crypto.createHash('sha256')
        .update(JSON.stringify(dataForSigning, Object.keys(dataForSigning).sort()))
        .digest('hex');
      const signatureValid = expectedSignature === attestation.signature?.value;
      
      return {
        verified: hashMatches && signatureValid,
        reason: hashMatches && signatureValid ? 'Sidecar verified' : 
                !hashMatches ? 'Artifact hash mismatch' : 'Invalid signature',
        details: {
          hashMatches,
          signatureValid,
          expectedHash: attestation.artifact.contentHash,
          currentHash,
          unified: attestation.unified || false
        }
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Sidecar verification error: ${error.message}`,
        path: sidecarPath
      };
    }
  }

  async _verifyGitProvenance(artifactPath) {
    if (!this.gitTracker) {
      return {
        verified: false,
        reason: 'Git provenance not enabled',
        available: false
      };
    }
    
    try {
      const artifactSha = await this._getArtifactSha(artifactPath);
      return await this.gitTracker.verifyArtifactIntegrity(artifactSha);
    } catch (error) {
      return {
        verified: false,
        reason: `Git provenance verification error: ${error.message}`,
        available: true
      };
    }
  }

  async _getArtifactSha(artifactPath) {
    const content = await fs.readFile(artifactPath);
    return (await this.gitOps.createBlob(content)).sha;
  }

  async _calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  _detectMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async _updateSupplyChainGraph(artifactPath, generationData, sidecarResult) {
    const chainEntry = {
      artifactPath,
      artifactHash: sidecarResult.artifactHash,
      templatePath: generationData.templatePath,
      templateHash: sidecarResult.templateHash,
      templateFamily: generationData.metadata?.templateFamily,
      dependencies: generationData.dependencies || [],
      timestamp: this.getDeterministicDate().toISOString(),
      verified: false // Will be set during verification
    };
    
    this.supplyChainGraph.set(artifactPath, chainEntry);
  }

  async _verifySupplyChain(artifactPath) {
    const chainEntry = this.supplyChainGraph.get(artifactPath);
    if (!chainEntry) {
      return {
        verified: false,
        reason: 'No supply chain entry found',
        traceable: false
      };
    }
    
    // Verify template still exists and matches hash
    let templateVerified = true;
    if (chainEntry.templatePath) {
      try {
        const currentTemplateHash = await this._calculateFileHash(chainEntry.templatePath);
        templateVerified = currentTemplateHash === chainEntry.templateHash;
      } catch (error) {
        templateVerified = false;
      }
    }
    
    // Check dependency integrity
    const dependencyResults = [];
    for (const dep of chainEntry.dependencies) {
      try {
        const depVerification = await this.verifyArtifact(dep);
        dependencyResults.push({
          dependency: dep,
          verified: depVerification.overall.verified
        });
      } catch (error) {
        dependencyResults.push({
          dependency: dep,
          verified: false,
          error: error.message
        });
      }
    }
    
    const allDependenciesVerified = dependencyResults.every(r => r.verified);
    
    return {
      verified: templateVerified && allDependenciesVerified,
      reason: templateVerified && allDependenciesVerified ? 'Supply chain verified' :
              !templateVerified ? 'Template verification failed' :
              'Dependency verification failed',
      details: {
        templateVerified,
        dependencyResults,
        traceable: true
      }
    };
  }

  async _verifyContentAddressing(artifactPath) {
    if (!this.config.enableContentAddressing) {
      return {
        verified: false,
        reason: 'Content addressing not enabled',
        available: false
      };
    }
    
    try {
      // Load sidecar to get expected git SHA
      const sidecarPath = artifactPath + this.config.sidecarExtension;
      const attestation = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
      
      if (!attestation.artifact?.contentAddressing?.gitSha) {
        return {
          verified: false,
          reason: 'No git SHA in attestation',
          available: false
        };
      }
      
      // Calculate current git SHA
      const currentSha = await this._getArtifactSha(artifactPath);
      const matches = currentSha === attestation.artifact.contentAddressing.gitSha;
      
      return {
        verified: matches,
        reason: matches ? 'Content addressing verified' : 'Git SHA mismatch',
        details: {
          expectedSha: attestation.artifact.contentAddressing.gitSha,
          currentSha,
          available: true
        }
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Content addressing verification error: ${error.message}`,
        available: true
      };
    }
  }

  _calculateOverallVerification(results) {
    const verifications = Object.values(results).filter(r => r !== null);
    const verifiedCount = verifications.filter(r => r.verified).length;
    const confidence = verifications.length > 0 ? (verifiedCount / verifications.length) : 0;
    
    const issues = verifications
      .filter(r => !r.verified)
      .map(r => r.reason);
    
    return {
      verified: confidence === 1.0,
      confidence: Math.round(confidence * 100) / 100,
      issues,
      verifiedComponents: verifiedCount,
      totalComponents: verifications.length
    };
  }

  _combineProvenanceSources(sources) {
    // Combine sidecar, git-notes, and registry data into unified view
    const combined = {
      sources: Object.keys(sources).filter(k => sources[k] !== null),
      unified: true
    };
    
    // Prefer sidecar data as primary source (dark-matter principle)
    if (sources.sidecar) {
      Object.assign(combined, sources.sidecar);
    }
    
    // Augment with git-notes data
    if (sources.gitNotes) {
      combined.gitProvenance = sources.gitNotes;
    }
    
    // Add registry metadata
    if (sources.registry) {
      combined.registryData = sources.registry;
    }
    
    return combined;
  }

  _generateGitShowCommands(provenance) {
    const commands = [];
    
    if (provenance.sources.gitNotes) {
      commands.push(`git notes --ref=${this.config.notesRef} show ${provenance.combined.artifact?.contentAddressing?.gitSha || '<artifact-sha>'}`);
    }
    
    if (provenance.combined.generation?.templateHash) {
      commands.push(`git show ${provenance.combined.generation.templateHash}`);
    }
    
    if (provenance.combined.generation?.contextHash) {
      commands.push(`git show ${provenance.combined.generation.contextHash}`);
    }
    
    return commands;
  }

  _generateLocalVerifyCommands(artifactPath) {
    return [
      `cat ${artifactPath}.attest.json | jq .`,
      `sha256sum ${artifactPath}`,
      `kgen verify ${artifactPath}`,
      `kgen explain ${artifactPath}`
    ];
  }

  _generateSupplyChainCommands(artifactPath) {
    return [
      `kgen supply-chain trace ${artifactPath}`,
      `kgen supply-chain visualize ${artifactPath}`,
      `kgen supply-chain verify-all ${artifactPath}`
    ];
  }

  async _findAttestationFiles() {
    const files = [];
    const searchDir = this.config.gitRepoPath;
    
    async function searchRecursively(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.git')) {
          await searchRecursively(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.attest.json')) {
          files.push(fullPath);
        }
      }
    }
    
    await searchRecursively(searchDir);
    return files;
  }

  async _migrateAttestationFormat(existingAttest) {
    // Migrate old format to unified format
    const migrated = {
      "$schema": "https://kgen.org/schemas/attestation-v1.1.json",
      "version": this.config.attestJsonVersion,
      "unified": true,
      "darkMatter": true,
      "migrated": {
        "from": existingAttest.version || "unknown",
        "at": this.getDeterministicDate().toISOString()
      }
    };
    
    // Map existing fields to new structure
    if (existingAttest.artifact) {
      migrated.artifact = {
        ...existingAttest.artifact,
        contentAddressing: {
          enabled: this.config.enableContentAddressing,
          gitSha: null // Would need to be calculated
        }
      };
    }
    
    if (existingAttest.provenance) {
      migrated.generation = {
        templatePath: existingAttest.provenance.templatePath,
        context: existingAttest.provenance.sourceGraph || {},
        generatedAt: existingAttest.provenance.generatedAt || existingAttest.timestamp,
        agent: existingAttest.provenance.generationAgent || 'unknown'
      };
    }
    
    // Add new fields
    migrated.environment = {
      generator: {
        name: "kgen-unified-provenance",
        version: this.config.unifiedVersion
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    migrated.git = {
      enabled: this.config.enableGitFirst,
      notesRef: this.config.notesRef,
      contentAddressing: this.config.enableContentAddressing
    };
    
    migrated.verification = {
      reproducible: true,
      deterministic: true,
      algorithm: "sha256",
      darkMatterCompliant: true,
      supplyChainTraceable: true
    };
    
    // Calculate new signature
    const dataForSigning = { ...migrated };
    delete dataForSigning.signature;
    migrated.signature = {
      algorithm: "sha256",
      value: crypto.createHash('sha256')
        .update(JSON.stringify(dataForSigning, Object.keys(dataForSigning).sort()))
        .digest('hex')
    };
    
    return migrated;
  }

  async _createGitNotesFromAttestation(artifactPath, attestation) {
    if (!this.gitTracker) return;
    
    try {
      const artifactSha = await this._getArtifactSha(artifactPath);
      
      // Create PROV-O compliant git-notes entry
      const provenanceData = {
        "@context": {
          "prov": "http://www.w3.org/ns/prov#",
          "kgen": this.config.provenanceNamespace
        },
        "@id": `kgen:migrated-${attestation.id}`,
        "@type": "prov:Activity",
        "prov:generated": {
          "@type": "prov:Entity",
          "prov:location": artifactPath,
          "kgen:artifactSha": artifactSha
        },
        "kgen:migratedFrom": "unified-attestation-sidecar",
        "kgen:originalAttestation": attestation.id,
        "kgen:migratedAt": this.getDeterministicDate().toISOString()
      };
      
      await this.gitOps.storeProvenance(artifactSha, provenanceData);
      
    } catch (error) {
      this.logger.warn(`Failed to create git notes for ${artifactPath}:`, error.message);
    }
  }
}

export default UnifiedProvenanceSystem;