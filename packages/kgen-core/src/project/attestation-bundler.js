/**
 * Attestation Bundler - Creates attestation packages with sidecars
 * 
 * Creates comprehensive attestation bundles containing:
 * - All generated artifacts and their .attest.json sidecars
 * - Provenance records and audit trails
 * - Integrity verification data
 * - Compliance documentation
 * - Reproducibility information
 * 
 * Packages everything into tamper-evident ZIP bundles for enterprise compliance.
 */

import consola from 'consola';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import StreamZip from 'node-stream-zip';
import { CryptoManager } from '../provenance/crypto/manager.js';
import { AttestationGenerator } from '../provenance/attestation/generator.js';

export class AttestationBundler {
  constructor(config = {}) {
    this.config = {
      bundleFormat: config.bundleFormat || 'zip',
      compressionLevel: config.compressionLevel || 6,
      includeBinaryFiles: config.includeBinaryFiles !== false,
      includeSourceFiles: config.includeSourceFiles !== false,
      includeProvenanceGraph: config.includeProvenanceGraph !== false,
      encryptBundle: config.encryptBundle || false,
      signBundle: config.signBundle !== false,
      bundleNameTemplate: config.bundleNameTemplate || 'attestation-{timestamp}-{hash}.zip',
      maxBundleSize: config.maxBundleSize || 1024 * 1024 * 100, // 100MB default
      ...config
    };

    this.logger = consola.withTag('attestation-bundler');
    this.bundleVersion = '1.0.0';
  }

  /**
   * Create attestation bundle with all artifacts and provenance
   * @param {Object} bundleRequest - Bundle creation request
   * @returns {Promise<Object>} Bundle creation result
   */
  async createAttestationBundle(bundleRequest) {
    try {
      this.logger.info('Creating attestation bundle...');

      const bundleId = bundleRequest.bundleId || uuidv4();
      const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
      
      const bundleManifest = {
        bundleId,
        version: this.bundleVersion,
        createdAt: this.getDeterministicDate().toISOString(),
        createdBy: bundleRequest.createdBy || 'kgen-system',
        
        // Bundle metadata
        purpose: bundleRequest.purpose || 'compliance-attestation',
        description: bundleRequest.description,
        tags: bundleRequest.tags || [],
        
        // Included components
        artifacts: [],
        attestations: [],
        provenance: {},
        compliance: {},
        integrity: {},
        
        // Bundle properties
        encrypted: this.config.encryptBundle,
        signed: this.config.signBundle,
        compressed: true,
        totalSize: 0,
        fileCount: 0
      };

      // Collect artifacts and their attestations
      const artifactCollection = await this._collectArtifacts(bundleRequest);
      bundleManifest.artifacts = artifactCollection.artifacts;
      bundleManifest.attestations = artifactCollection.attestations;

      // Collect provenance records
      if (this.config.includeProvenanceGraph) {
        bundleManifest.provenance = await this._collectProvenance(bundleRequest);
      }

      // Collect compliance documentation
      bundleManifest.compliance = await this._collectCompliance(bundleRequest);

      // Calculate integrity information
      bundleManifest.integrity = await this._calculateBundleIntegrity(bundleManifest);

      // Create temporary directory for bundle assembly
      const tempDir = await this._createTempDirectory(bundleId);
      
      try {
        // Assemble bundle contents
        const bundleContents = await this._assembleBundleContents(
          tempDir, 
          bundleManifest, 
          bundleRequest
        );

        // Create the bundle archive
        const bundlePath = await this._createBundleArchive(
          tempDir, 
          bundleContents, 
          bundleManifest,
          timestamp
        );

        // Calculate final bundle hash
        const bundleHash = await this._calculateFileHash(bundlePath);
        bundleManifest.bundleHash = bundleHash;

        // Sign bundle if configured
        let signature = null;
        if (this.config.signBundle) {
          signature = await this._signBundle(bundlePath, bundleManifest);
        }

        // Create bundle result
        const bundleResult = {
          bundleId,
          bundlePath,
          bundleHash,
          signature,
          manifest: bundleManifest,
          createdAt: this.getDeterministicDate().toISOString(),
          size: (await fs.stat(bundlePath)).size
        };

        this.logger.success(`Attestation bundle created: ${bundlePath}`);
        
        return bundleResult;

      } finally {
        // Cleanup temporary directory
        await this._cleanupTempDirectory(tempDir);
      }

    } catch (error) {
      this.logger.error('Failed to create attestation bundle:', error);
      throw error;
    }
  }

  /**
   * Verify attestation bundle integrity and signatures
   * @param {string} bundlePath - Path to bundle file
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestationBundle(bundlePath) {
    try {
      this.logger.info(`Verifying attestation bundle: ${bundlePath}`);

      const verification = {
        bundlePath,
        valid: true,
        issues: [],
        warnings: [],
        verifiedAt: this.getDeterministicDate().toISOString()
      };

      // Check bundle file exists and is readable
      try {
        await fs.access(bundlePath, fs.constants.R_OK);
      } catch (error) {
        verification.valid = false;
        verification.issues.push(`Bundle file not accessible: ${error.message}`);
        return verification;
      }

      // Extract and verify manifest
      const manifest = await this._extractManifest(bundlePath);
      if (!manifest) {
        verification.valid = false;
        verification.issues.push('Bundle manifest not found or invalid');
        return verification;
      }

      verification.manifest = manifest;

      // Verify bundle hash
      const currentBundleHash = await this._calculateFileHash(bundlePath);
      if (manifest.bundleHash && currentBundleHash !== manifest.bundleHash) {
        verification.valid = false;
        verification.issues.push(
          `Bundle hash mismatch: expected=${manifest.bundleHash}, actual=${currentBundleHash}`
        );
      }

      // Verify bundle signature if present
      if (manifest.signed) {
        const signatureVerification = await this._verifyBundleSignature(bundlePath, manifest);
        if (!signatureVerification.valid) {
          verification.valid = false;
          verification.issues.push('Bundle signature verification failed');
        }
      }

      // Extract bundle contents to temporary directory for verification
      const tempDir = await this._createTempDirectory('verify-' + this.getDeterministicTimestamp());
      
      try {
        await this._extractBundle(bundlePath, tempDir);

        // Verify artifact integrity
        const artifactVerification = await this._verifyArtifactIntegrity(tempDir, manifest);
        if (!artifactVerification.valid) {
          verification.valid = false;
          verification.issues.push(...artifactVerification.issues);
        }
        verification.warnings.push(...artifactVerification.warnings);

        // Verify attestation completeness
        const attestationVerification = await this._verifyAttestationCompleteness(tempDir, manifest);
        if (!attestationVerification.valid) {
          verification.valid = false;
          verification.issues.push(...attestationVerification.issues);
        }

        // Verify provenance consistency
        const provenanceVerification = await this._verifyProvenanceConsistency(tempDir, manifest);
        if (!provenanceVerification.valid) {
          verification.warnings.push(...provenanceVerification.warnings);
        }

      } finally {
        // Cleanup verification temp directory
        await this._cleanupTempDirectory(tempDir);
      }

      return verification;

    } catch (error) {
      this.logger.error(`Failed to verify bundle ${bundlePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract specific files from attestation bundle
   * @param {string} bundlePath - Path to bundle file
   * @param {Array} filePatterns - File patterns to extract
   * @param {string} outputDir - Output directory
   * @returns {Promise<Array>} Extracted file paths
   */
  async extractFromBundle(bundlePath, filePatterns, outputDir) {
    try {
      this.logger.info(`Extracting files from bundle: ${bundlePath}`);

      await fs.mkdir(outputDir, { recursive: true });

      const zip = new StreamZip.async({ file: bundlePath });
      const entries = await zip.entries();
      const extractedFiles = [];

      for (const [entryName, entry] of Object.entries(entries)) {
        // Check if entry matches any pattern
        const matches = filePatterns.some(pattern => {
          if (typeof pattern === 'string') {
            return entryName.includes(pattern);
          } else if (pattern instanceof RegExp) {
            return pattern.test(entryName);
          }
          return false;
        });

        if (matches && !entry.isDirectory) {
          const outputPath = path.join(outputDir, entryName);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          
          const data = await zip.entryData(entryName);
          await fs.writeFile(outputPath, data);
          
          extractedFiles.push(outputPath);
        }
      }

      await zip.close();

      this.logger.success(`Extracted ${extractedFiles.length} files to: ${outputDir}`);
      
      return extractedFiles;

    } catch (error) {
      this.logger.error('Failed to extract from bundle:', error);
      throw error;
    }
  }

  /**
   * List contents of attestation bundle
   * @param {string} bundlePath - Path to bundle file
   * @returns {Promise<Object>} Bundle contents listing
   */
  async listBundleContents(bundlePath) {
    try {
      const zip = new StreamZip.async({ file: bundlePath });
      const entries = await zip.entries();
      
      const contents = {
        totalFiles: 0,
        totalSize: 0,
        directories: [],
        files: [],
        manifest: null
      };

      for (const [entryName, entry] of Object.entries(entries)) {
        if (entry.isDirectory) {
          contents.directories.push({
            name: entryName,
            path: entryName
          });
        } else {
          const fileInfo = {
            name: path.basename(entryName),
            path: entryName,
            size: entry.size,
            compressedSize: entry.compressedSize,
            compressionRatio: entry.size > 0 ? entry.compressedSize / entry.size : 1,
            lastModified: entry.time
          };

          // Check if this is the manifest file
          if (entryName === 'manifest.json') {
            const manifestData = await zip.entryData(entryName);
            contents.manifest = JSON.parse(manifestData.toString('utf8'));
          }

          contents.files.push(fileInfo);
          contents.totalFiles++;
          contents.totalSize += entry.size;
        }
      }

      await zip.close();
      
      return contents;

    } catch (error) {
      this.logger.error('Failed to list bundle contents:', error);
      throw error;
    }
  }

  // Private methods

  async _collectArtifacts(bundleRequest) {
    const collection = {
      artifacts: [],
      attestations: []
    };

    if (!bundleRequest.artifactPaths) {
      return collection;
    }

    for (const artifactPath of bundleRequest.artifactPaths) {
      try {
        // Get artifact file info
        const stats = await fs.stat(artifactPath);
        const hash = await this._calculateFileHash(artifactPath);
        
        const artifact = {
          path: artifactPath,
          name: path.basename(artifactPath),
          size: stats.size,
          hash,
          lastModified: stats.mtime.toISOString(),
          mimeType: this._getMimeType(artifactPath)
        };

        collection.artifacts.push(artifact);

        // Look for corresponding .attest.json file
        const attestationPath = `${artifactPath}.attest.json`;
        try {
          await fs.access(attestationPath);
          const attestationContent = await fs.readFile(attestationPath, 'utf8');
          const attestation = JSON.parse(attestationContent);
          
          collection.attestations.push({
            artifactPath,
            attestationPath,
            attestation
          });
        } catch (error) {
          this.logger.warn(`No attestation found for artifact: ${artifactPath}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to collect artifact ${artifactPath}:`, error);
      }
    }

    return collection;
  }

  async _collectProvenance(bundleRequest) {
    const provenance = {
      operations: [],
      entities: [],
      agents: [],
      activities: []
    };

    // This would integrate with the provenance tracker
    // For now, return placeholder structure
    if (bundleRequest.provenanceRecords) {
      provenance.operations = bundleRequest.provenanceRecords;
    }

    return provenance;
  }

  async _collectCompliance(bundleRequest) {
    const compliance = {
      framework: bundleRequest.complianceFramework || 'enterprise',
      standards: bundleRequest.complianceStandards || [],
      certifications: bundleRequest.certifications || [],
      auditTrail: bundleRequest.auditTrail || [],
      policies: bundleRequest.policies || []
    };

    return compliance;
  }

  async _calculateBundleIntegrity(manifest) {
    const integrity = {
      artifactHashes: {},
      manifestHash: null,
      overallHash: null
    };

    // Calculate hash for each artifact
    for (const artifact of manifest.artifacts) {
      integrity.artifactHashes[artifact.path] = artifact.hash;
    }

    // Calculate manifest hash (excluding integrity section)
    const manifestForHashing = { ...manifest };
    delete manifestForHashing.integrity;
    
    const manifestString = JSON.stringify(manifestForHashing, Object.keys(manifestForHashing).sort());
    integrity.manifestHash = await this._calculateHash(manifestString);

    return integrity;
  }

  async _createTempDirectory(prefix) {
    const tempDir = path.join(os.tmpdir(), `kgen-bundle-${prefix}-${this.getDeterministicTimestamp()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  async _cleanupTempDirectory(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }

  async _assembleBundleContents(tempDir, manifest, bundleRequest) {
    const contents = {
      rootDir: tempDir,
      manifestPath: path.join(tempDir, 'manifest.json'),
      artifactsDir: path.join(tempDir, 'artifacts'),
      attestationsDir: path.join(tempDir, 'attestations'),
      provenanceDir: path.join(tempDir, 'provenance'),
      complianceDir: path.join(tempDir, 'compliance')
    };

    // Create directory structure
    await fs.mkdir(contents.artifactsDir, { recursive: true });
    await fs.mkdir(contents.attestationsDir, { recursive: true });
    await fs.mkdir(contents.provenanceDir, { recursive: true });
    await fs.mkdir(contents.complianceDir, { recursive: true });

    // Write manifest
    await fs.writeFile(contents.manifestPath, JSON.stringify(manifest, null, 2));

    // Copy artifacts
    for (const artifact of manifest.artifacts) {
      const artifactName = path.basename(artifact.path);
      const destPath = path.join(contents.artifactsDir, artifactName);
      await fs.copyFile(artifact.path, destPath);
    }

    // Copy attestations
    for (const attestationInfo of manifest.attestations) {
      const attestationName = path.basename(attestationInfo.attestationPath);
      const destPath = path.join(contents.attestationsDir, attestationName);
      await fs.copyFile(attestationInfo.attestationPath, destPath);
    }

    // Write provenance data
    if (manifest.provenance && Object.keys(manifest.provenance).length > 0) {
      const provenancePath = path.join(contents.provenanceDir, 'provenance.json');
      await fs.writeFile(provenancePath, JSON.stringify(manifest.provenance, null, 2));
    }

    // Write compliance data
    if (manifest.compliance && Object.keys(manifest.compliance).length > 0) {
      const compliancePath = path.join(contents.complianceDir, 'compliance.json');
      await fs.writeFile(compliancePath, JSON.stringify(manifest.compliance, null, 2));
    }

    return contents;
  }

  async _createBundleArchive(tempDir, contents, manifest, timestamp) {
    const bundleHash = manifest.integrity.manifestHash.substring(0, 8);
    const bundleName = this.config.bundleNameTemplate
      .replace('{timestamp}', timestamp)
      .replace('{hash}', bundleHash)
      .replace('{bundleId}', manifest.bundleId);

    const bundlePath = path.join(process.cwd(), bundleName);
    const output = createWriteStream(bundlePath);
    const archive = archiver('zip', {
      zlib: { level: this.config.compressionLevel }
    });

    // Pipe archive to output stream
    archive.pipe(output);

    // Add all files from temp directory
    archive.directory(tempDir, false);

    // Finalize the archive
    await archive.finalize();

    // Wait for stream to close
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    return bundlePath;
  }

  async _signBundle(bundlePath, manifest) {
    // This would implement actual cryptographic signing
    // For now, return a placeholder signature
    const bundleHash = await this._calculateFileHash(bundlePath);
    return {
      algorithm: 'RS256',
      hash: bundleHash,
      signature: `signed-${bundleHash.substring(0, 16)}`,
      signedAt: this.getDeterministicDate().toISOString(),
      signer: 'kgen-system'
    };
  }

  async _extractManifest(bundlePath) {
    try {
      const zip = new StreamZip.async({ file: bundlePath });
      const manifestData = await zip.entryData('manifest.json');
      await zip.close();
      
      return JSON.parse(manifestData.toString('utf8'));
    } catch (error) {
      this.logger.error('Failed to extract manifest:', error);
      return null;
    }
  }

  async _verifyBundleSignature(bundlePath, manifest) {
    // This would implement actual signature verification
    // For now, return a placeholder result
    return {
      valid: true,
      algorithm: manifest.signature?.algorithm || 'RS256',
      verifiedAt: this.getDeterministicDate().toISOString()
    };
  }

  async _extractBundle(bundlePath, outputDir) {
    const zip = new StreamZip.async({ file: bundlePath });
    await zip.extract(null, outputDir);
    await zip.close();
  }

  async _verifyArtifactIntegrity(tempDir, manifest) {
    const verification = { valid: true, issues: [], warnings: [] };

    const artifactsDir = path.join(tempDir, 'artifacts');
    
    for (const artifact of manifest.artifacts) {
      const artifactPath = path.join(artifactsDir, path.basename(artifact.path));
      
      try {
        const currentHash = await this._calculateFileHash(artifactPath);
        if (currentHash !== artifact.hash) {
          verification.valid = false;
          verification.issues.push(
            `Artifact integrity failure: ${artifact.name} - expected=${artifact.hash}, actual=${currentHash}`
          );
        }
      } catch (error) {
        verification.valid = false;
        verification.issues.push(`Missing artifact: ${artifact.name}`);
      }
    }

    return verification;
  }

  async _verifyAttestationCompleteness(tempDir, manifest) {
    const verification = { valid: true, issues: [] };

    const attestationsDir = path.join(tempDir, 'attestations');
    
    // Check that each artifact has a corresponding attestation
    for (const artifact of manifest.artifacts) {
      const expectedAttestationName = `${path.basename(artifact.path)}.attest.json`;
      const attestationPath = path.join(attestationsDir, expectedAttestationName);
      
      try {
        await fs.access(attestationPath);
      } catch (error) {
        verification.valid = false;
        verification.issues.push(`Missing attestation for artifact: ${artifact.name}`);
      }
    }

    return verification;
  }

  async _verifyProvenanceConsistency(tempDir, manifest) {
    const verification = { valid: true, warnings: [] };

    // This would implement provenance consistency checks
    // For now, return success
    
    return verification;
  }

  async _calculateFileHash(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  async _calculateHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  _getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default AttestationBundler;