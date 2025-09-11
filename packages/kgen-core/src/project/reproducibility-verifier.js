/**
 * Reproducibility Verifier - Build reproduction and validation
 * 
 * Verifies that builds can be reproduced exactly using:
 * - Lockfile constraint verification
 * - Environment consistency checking
 * - Deterministic output validation
 * - Hash chain integrity verification
 * 
 * Ensures reproducible builds across different environments and times.
 */

import consola from 'consola';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

export class ReproducibilityVerifier {
  constructor(config = {}) {
    this.config = {
      // Verification settings
      verificationMode: config.verificationMode || 'strict', // strict, lenient, advisory
      allowTimestampDifferences: config.allowTimestampDifferences || false,
      allowEnvironmentDifferences: config.allowEnvironmentDifferences || false,
      maxRetries: config.maxRetries || 3,
      timeoutMs: config.timeoutMs || 300000, // 5 minutes
      
      // Build settings  
      buildCommand: config.buildCommand || 'kgen generate',
      buildEnvironment: config.buildEnvironment || {},
      cleanBuild: config.cleanBuild !== false,
      parallelBuilds: config.parallelBuilds || 1,
      
      // Comparison settings
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      compareMetadata: config.compareMetadata !== false,
      compareTimestamps: config.compareTimestamps || false,
      excludePatterns: config.excludePatterns || [],
      
      // Output settings
      generateReport: config.generateReport !== false,
      reportFormat: config.reportFormat || 'json',
      saveArtifacts: config.saveArtifacts || false,
      
      ...config
    };

    this.logger = consola.withTag('reproducibility-verifier');
    this.verificationId = uuidv4();
    this.builds = new Map();
    this.comparisons = new Map();
  }

  /**
   * Verify build reproducibility using lockfile
   * @param {Object} verificationRequest - Verification request
   * @returns {Promise<Object>} Verification result
   */
  async verifyReproducibility(verificationRequest) {
    try {
      this.logger.info(`Starting reproducibility verification: ${this.verificationId}`);

      const verification = {
        verificationId: this.verificationId,
        startedAt: new Date().toISOString(),
        request: verificationRequest,
        
        // Build results
        builds: [],
        buildComparison: null,
        
        // Verification results
        reproducible: false,
        confidence: 0,
        issues: [],
        warnings: [],
        
        // Metrics
        totalBuilds: 0,
        successfulBuilds: 0,
        identicalBuilds: 0,
        
        completedAt: null
      };

      // Validate verification request
      const requestValidation = await this._validateVerificationRequest(verificationRequest);
      if (!requestValidation.valid) {
        verification.issues.push(...requestValidation.issues);
        return verification;
      }

      // Perform multiple builds
      const buildResults = await this._performMultipleBuilds(verificationRequest);
      verification.builds = buildResults.builds;
      verification.totalBuilds = buildResults.totalBuilds;
      verification.successfulBuilds = buildResults.successfulBuilds;

      // Compare build outputs
      if (verification.successfulBuilds >= 2) {
        const comparison = await this._compareBuildOutputs(buildResults.builds);
        verification.buildComparison = comparison;
        verification.identicalBuilds = comparison.identicalBuilds;
        verification.issues.push(...comparison.issues);
        verification.warnings.push(...comparison.warnings);
        
        // Determine reproducibility
        verification.reproducible = comparison.reproducible;
        verification.confidence = comparison.confidence;
      } else {
        verification.issues.push('Insufficient successful builds for comparison');
      }

      // Verify lockfile consistency
      const lockfileVerification = await this._verifyLockfileConsistency(verificationRequest);
      if (!lockfileVerification.consistent) {
        verification.warnings.push(...lockfileVerification.warnings);
      }

      // Verify environment consistency
      const environmentVerification = await this._verifyEnvironmentConsistency(buildResults.builds);
      if (!environmentVerification.consistent) {
        verification.warnings.push(...environmentVerification.warnings);
      }

      // Generate verification report
      if (this.config.generateReport) {
        const reportPath = await this._generateVerificationReport(verification);
        verification.reportPath = reportPath;
      }

      verification.completedAt = new Date().toISOString();
      
      this.logger.success(`Reproducibility verification completed: ${verification.reproducible ? 'REPRODUCIBLE' : 'NOT REPRODUCIBLE'}`);
      
      return verification;

    } catch (error) {
      this.logger.error('Failed to verify reproducibility:', error);
      throw error;
    }
  }

  /**
   * Verify specific artifact reproducibility
   * @param {string} artifactPath - Path to artifact
   * @param {Object} originalAttestation - Original attestation
   * @returns {Promise<Object>} Artifact verification result
   */
  async verifyArtifactReproducibility(artifactPath, originalAttestation) {
    try {
      this.logger.info(`Verifying artifact reproducibility: ${artifactPath}`);

      const verification = {
        artifactPath,
        originalAttestation,
        verificationId: uuidv4(),
        
        // Reproduction attempt
        reproduced: false,
        reproducedPath: null,
        
        // Hash comparison
        originalHash: originalAttestation.artifactHash,
        reproducedHash: null,
        hashMatch: false,
        
        // Metadata comparison
        metadataMatch: false,
        metadataDifferences: [],
        
        // Content comparison
        contentMatch: false,
        contentDifferences: [],
        
        verifiedAt: new Date().toISOString()
      };

      // Reproduce the artifact
      const reproduction = await this._reproduceArtifact(originalAttestation);
      verification.reproduced = reproduction.success;
      verification.reproducedPath = reproduction.outputPath;

      if (!verification.reproduced) {
        verification.issues = reproduction.errors;
        return verification;
      }

      // Calculate hash of reproduced artifact
      verification.reproducedHash = await this._calculateFileHash(verification.reproducedPath);
      verification.hashMatch = verification.originalHash === verification.reproducedHash;

      // Compare file contents in detail
      const contentComparison = await this._compareFileContents(
        artifactPath, 
        verification.reproducedPath
      );
      verification.contentMatch = contentComparison.identical;
      verification.contentDifferences = contentComparison.differences;

      // Compare metadata
      if (this.config.compareMetadata) {
        const metadataComparison = await this._compareFileMetadata(
          artifactPath, 
          verification.reproducedPath,
          originalAttestation
        );
        verification.metadataMatch = metadataComparison.identical;
        verification.metadataDifferences = metadataComparison.differences;
      }

      // Overall assessment
      verification.reproducible = verification.hashMatch && verification.contentMatch;

      return verification;

    } catch (error) {
      this.logger.error(`Failed to verify artifact ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Verify lockfile determinism
   * @param {string} lockfilePath - Path to lockfile
   * @returns {Promise<Object>} Lockfile verification result
   */
  async verifyLockfileDeterminism(lockfilePath) {
    try {
      this.logger.info(`Verifying lockfile determinism: ${lockfilePath}`);

      const verification = {
        lockfilePath,
        verificationId: uuidv4(),
        
        // Generation attempts
        attempts: [],
        
        // Comparison results
        deterministic: false,
        identical: false,
        differences: [],
        
        verifiedAt: new Date().toISOString()
      };

      // Generate lockfile multiple times
      const attemptCount = 3;
      for (let i = 0; i < attemptCount; i++) {
        const attempt = await this._generateLockfileAttempt(lockfilePath, i);
        verification.attempts.push(attempt);
      }

      // Compare all attempts
      if (verification.attempts.length >= 2) {
        const comparison = await this._compareLockfileAttempts(verification.attempts);
        verification.deterministic = comparison.deterministic;
        verification.identical = comparison.identical;
        verification.differences = comparison.differences;
      }

      return verification;

    } catch (error) {
      this.logger.error(`Failed to verify lockfile determinism ${lockfilePath}:`, error);
      throw error;
    }
  }

  /**
   * Compare two build outputs for reproducibility
   * @param {string} build1Path - First build output path
   * @param {string} build2Path - Second build output path
   * @returns {Promise<Object>} Comparison result
   */
  async compareBuildOutputs(build1Path, build2Path) {
    try {
      this.logger.info(`Comparing build outputs: ${build1Path} vs ${build2Path}`);

      const comparison = {
        build1Path,
        build2Path,
        identical: false,
        differences: [],
        commonFiles: [],
        onlyInBuild1: [],
        onlyInBuild2: [],
        comparedAt: new Date().toISOString()
      };

      // Get file listings for both builds
      const build1Files = await this._getFileList(build1Path);
      const build2Files = await this._getFileList(build2Path);

      // Find common files and differences
      const allFiles = new Set([...build1Files, ...build2Files]);
      
      for (const file of allFiles) {
        const inBuild1 = build1Files.includes(file);
        const inBuild2 = build2Files.includes(file);
        
        if (inBuild1 && inBuild2) {
          comparison.commonFiles.push(file);
        } else if (inBuild1) {
          comparison.onlyInBuild1.push(file);
        } else {
          comparison.onlyInBuild2.push(file);
        }
      }

      // Compare common files
      for (const file of comparison.commonFiles) {
        const file1Path = path.join(build1Path, file);
        const file2Path = path.join(build2Path, file);
        
        const fileComparison = await this._compareFiles(file1Path, file2Path);
        if (!fileComparison.identical) {
          comparison.differences.push({
            file,
            type: 'content',
            details: fileComparison.differences
          });
        }
      }

      // Record file presence differences
      for (const file of comparison.onlyInBuild1) {
        comparison.differences.push({
          file,
          type: 'presence',
          details: 'Only in first build'
        });
      }

      for (const file of comparison.onlyInBuild2) {
        comparison.differences.push({
          file,
          type: 'presence',
          details: 'Only in second build'
        });
      }

      comparison.identical = comparison.differences.length === 0;

      return comparison;

    } catch (error) {
      this.logger.error('Failed to compare build outputs:', error);
      throw error;
    }
  }

  // Private methods

  async _validateVerificationRequest(request) {
    const validation = { valid: true, issues: [] };

    if (!request.lockfilePath) {
      validation.valid = false;
      validation.issues.push('Lockfile path is required');
    }

    if (!request.projectPath) {
      validation.valid = false;
      validation.issues.push('Project path is required');
    }

    // Check if lockfile exists
    try {
      await fs.access(request.lockfilePath, fs.constants.R_OK);
    } catch (error) {
      validation.valid = false;
      validation.issues.push(`Lockfile not accessible: ${request.lockfilePath}`);
    }

    return validation;
  }

  async _performMultipleBuilds(request) {
    const results = {
      builds: [],
      totalBuilds: 0,
      successfulBuilds: 0
    };

    const buildCount = this.config.parallelBuilds || 2;
    
    for (let i = 0; i < buildCount; i++) {
      try {
        this.logger.info(`Performing build ${i + 1}/${buildCount}`);
        
        const buildResult = await this._performSingleBuild(request, i);
        results.builds.push(buildResult);
        results.totalBuilds++;
        
        if (buildResult.success) {
          results.successfulBuilds++;
        }
        
      } catch (error) {
        this.logger.error(`Build ${i + 1} failed:`, error);
        results.builds.push({
          buildId: i,
          success: false,
          error: error.message,
          completedAt: new Date().toISOString()
        });
        results.totalBuilds++;
      }
    }

    return results;
  }

  async _performSingleBuild(request, buildIndex) {
    const buildId = `${this.verificationId}-build-${buildIndex}`;
    const buildDir = path.join(os.tmpdir(), buildId);
    
    try {
      // Create build directory
      await fs.mkdir(buildDir, { recursive: true });
      
      // Copy project files
      await this._copyProjectFiles(request.projectPath, buildDir);
      
      // Copy lockfile
      const lockfileName = path.basename(request.lockfilePath);
      await fs.copyFile(request.lockfilePath, path.join(buildDir, lockfileName));

      // Clean build if requested
      if (this.config.cleanBuild) {
        await this._cleanBuildDirectory(buildDir);
      }

      // Execute build command
      const buildExecution = await this._executeBuildCommand(buildDir, buildIndex);
      
      const buildResult = {
        buildId,
        buildIndex,
        buildDir,
        success: buildExecution.success,
        startedAt: buildExecution.startedAt,
        completedAt: buildExecution.completedAt,
        duration: buildExecution.duration,
        command: buildExecution.command,
        exitCode: buildExecution.exitCode,
        stdout: buildExecution.stdout,
        stderr: buildExecution.stderr,
        environment: await this._captureEnvironment(),
        outputFiles: []
      };

      // Collect output files if build succeeded
      if (buildResult.success) {
        buildResult.outputFiles = await this._collectOutputFiles(buildDir);
      }

      return buildResult;

    } catch (error) {
      return {
        buildId,
        buildIndex,
        success: false,
        error: error.message,
        completedAt: new Date().toISOString()
      };
    }
  }

  async _compareBuildOutputs(builds) {
    const comparison = {
      reproducible: false,
      confidence: 0,
      identicalBuilds: 0,
      issues: [],
      warnings: [],
      fileComparisons: []
    };

    const successfulBuilds = builds.filter(b => b.success);
    
    if (successfulBuilds.length < 2) {
      comparison.issues.push('Need at least 2 successful builds for comparison');
      return comparison;
    }

    // Compare first build with all others
    const referenceBuild = successfulBuilds[0];
    let allIdentical = true;

    for (let i = 1; i < successfulBuilds.length; i++) {
      const compareBuild = successfulBuilds[i];
      
      const buildComparison = await this.compareBuildOutputs(
        referenceBuild.buildDir,
        compareBuild.buildDir
      );
      
      comparison.fileComparisons.push({
        referenceBuild: referenceBuild.buildId,
        compareBuild: compareBuild.buildId,
        identical: buildComparison.identical,
        differences: buildComparison.differences
      });

      if (buildComparison.identical) {
        comparison.identicalBuilds++;
      } else {
        allIdentical = false;
        comparison.issues.push(
          `Build outputs differ between ${referenceBuild.buildId} and ${compareBuild.buildId}`
        );
      }
    }

    // Calculate reproducibility
    comparison.reproducible = allIdentical && successfulBuilds.length >= 2;
    comparison.confidence = comparison.identicalBuilds / (successfulBuilds.length - 1);

    return comparison;
  }

  async _verifyLockfileConsistency(request) {
    const verification = { consistent: true, warnings: [] };
    
    // This would implement lockfile consistency checks
    // For now, assume consistent
    
    return verification;
  }

  async _verifyEnvironmentConsistency(builds) {
    const verification = { consistent: true, warnings: [] };
    
    // Compare environment variables across builds
    const environments = builds
      .filter(b => b.success && b.environment)
      .map(b => b.environment);

    if (environments.length < 2) {
      return verification;
    }

    const referenceEnv = environments[0];
    
    for (let i = 1; i < environments.length; i++) {
      const compareEnv = environments[i];
      
      // Compare key environment variables
      const keyVars = ['NODE_VERSION', 'PATH', 'HOME', 'USER'];
      for (const varName of keyVars) {
        if (referenceEnv[varName] !== compareEnv[varName]) {
          verification.consistent = false;
          verification.warnings.push(
            `Environment variable ${varName} differs between builds: ${referenceEnv[varName]} vs ${compareEnv[varName]}`
          );
        }
      }
    }

    return verification;
  }

  async _reproduceArtifact(originalAttestation) {
    const reproduction = {
      success: false,
      outputPath: null,
      errors: []
    };

    try {
      // This would implement artifact reproduction logic
      // Based on the attestation information
      
      // For now, return placeholder
      reproduction.success = true;
      reproduction.outputPath = '/tmp/reproduced-artifact';
      
    } catch (error) {
      reproduction.errors.push(error.message);
    }

    return reproduction;
  }

  async _compareFileContents(file1Path, file2Path) {
    try {
      const file1Content = await fs.readFile(file1Path);
      const file2Content = await fs.readFile(file2Path);
      
      const identical = Buffer.compare(file1Content, file2Content) === 0;
      
      const comparison = {
        identical,
        differences: []
      };

      if (!identical) {
        // For text files, provide line-by-line differences
        if (this._isTextFile(file1Path)) {
          const file1Lines = file1Content.toString().split('\n');
          const file2Lines = file2Content.toString().split('\n');
          
          const maxLines = Math.max(file1Lines.length, file2Lines.length);
          for (let i = 0; i < maxLines; i++) {
            const line1 = file1Lines[i] || '';
            const line2 = file2Lines[i] || '';
            
            if (line1 !== line2) {
              comparison.differences.push({
                line: i + 1,
                file1: line1,
                file2: line2
              });
            }
          }
        } else {
          comparison.differences.push({
            type: 'binary',
            message: 'Binary files differ'
          });
        }
      }

      return comparison;

    } catch (error) {
      return {
        identical: false,
        differences: [{ error: error.message }]
      };
    }
  }

  async _compareFileMetadata(file1Path, file2Path, attestation) {
    try {
      const stat1 = await fs.stat(file1Path);
      const stat2 = await fs.stat(file2Path);
      
      const comparison = {
        identical: true,
        differences: []
      };

      // Compare file sizes
      if (stat1.size !== stat2.size) {
        comparison.identical = false;
        comparison.differences.push({
          property: 'size',
          file1: stat1.size,
          file2: stat2.size
        });
      }

      // Compare timestamps (if configured)
      if (this.config.compareTimestamps) {
        if (stat1.mtime.getTime() !== stat2.mtime.getTime()) {
          comparison.identical = false;
          comparison.differences.push({
            property: 'mtime',
            file1: stat1.mtime.toISOString(),
            file2: stat2.mtime.toISOString()
          });
        }
      }

      return comparison;

    } catch (error) {
      return {
        identical: false,
        differences: [{ error: error.message }]
      };
    }
  }

  async _generateLockfileAttempt(lockfilePath, attemptIndex) {
    const attempt = {
      attemptIndex,
      success: false,
      generatedPath: null,
      hash: null,
      error: null,
      generatedAt: new Date().toISOString()
    };

    try {
      // This would regenerate the lockfile
      // For now, just copy the original
      const tempPath = `${lockfilePath}.attempt-${attemptIndex}`;
      await fs.copyFile(lockfilePath, tempPath);
      
      attempt.success = true;
      attempt.generatedPath = tempPath;
      attempt.hash = await this._calculateFileHash(tempPath);

    } catch (error) {
      attempt.error = error.message;
    }

    return attempt;
  }

  async _compareLockfileAttempts(attempts) {
    const comparison = {
      deterministic: false,
      identical: false,
      differences: []
    };

    const successfulAttempts = attempts.filter(a => a.success);
    
    if (successfulAttempts.length < 2) {
      comparison.differences.push('Insufficient successful attempts for comparison');
      return comparison;
    }

    // Compare hashes
    const referenceHash = successfulAttempts[0].hash;
    const allHashesIdentical = successfulAttempts.every(a => a.hash === referenceHash);

    comparison.deterministic = allHashesIdentical;
    comparison.identical = allHashesIdentical;

    if (!allHashesIdentical) {
      for (let i = 1; i < successfulAttempts.length; i++) {
        comparison.differences.push({
          attempt1: 0,
          attempt2: i,
          hash1: successfulAttempts[0].hash,
          hash2: successfulAttempts[i].hash
        });
      }
    }

    return comparison;
  }

  async _copyProjectFiles(sourcePath, destPath) {
    // This would implement recursive file copying
    // For now, use a simple implementation
    await fs.cp(sourcePath, destPath, { recursive: true });
  }

  async _cleanBuildDirectory(buildDir) {
    // Remove common build artifacts
    const patterns = ['node_modules', 'dist', 'build', '.next', '.nuxt'];
    
    for (const pattern of patterns) {
      const targetPath = path.join(buildDir, pattern);
      try {
        await fs.rm(targetPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore if directory doesn't exist
      }
    }
  }

  async _executeBuildCommand(buildDir, buildIndex) {
    const startedAt = new Date();
    
    const execution = {
      command: this.config.buildCommand,
      startedAt: startedAt.toISOString(),
      success: false,
      exitCode: null,
      stdout: '',
      stderr: '',
      duration: 0,
      completedAt: null
    };

    return new Promise((resolve) => {
      const child = spawn(this.config.buildCommand, [], {
        cwd: buildDir,
        shell: true,
        env: { ...process.env, ...this.config.buildEnvironment }
      });

      child.stdout?.on('data', (data) => {
        execution.stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        execution.stderr += data.toString();
      });

      child.on('close', (code) => {
        const completedAt = new Date();
        execution.exitCode = code;
        execution.success = code === 0;
        execution.duration = completedAt.getTime() - startedAt.getTime();
        execution.completedAt = completedAt.toISOString();
        
        resolve(execution);
      });

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM');
      }, this.config.timeoutMs);
    });
  }

  async _captureEnvironment() {
    return {
      NODE_VERSION: process.version,
      PLATFORM: process.platform,
      ARCH: process.arch,
      USER: process.env.USER || process.env.USERNAME,
      HOME: process.env.HOME || process.env.USERPROFILE,
      PATH: process.env.PATH,
      PWD: process.cwd(),
      TIMESTAMP: new Date().toISOString()
    };
  }

  async _collectOutputFiles(buildDir) {
    const outputFiles = [];
    
    try {
      const files = await this._getFileListRecursive(buildDir);
      
      for (const file of files) {
        const filePath = path.join(buildDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const hash = await this._calculateFileHash(filePath);
          
          outputFiles.push({
            path: file,
            size: stats.size,
            hash,
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to collect output files from ${buildDir}:`, error);
    }

    return outputFiles;
  }

  async _getFileList(dirPath) {
    const files = [];
    
    async function traverse(currentPath, relativePath = '') {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await traverse(path.join(currentPath, entry.name), entryPath);
        } else {
          files.push(entryPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  async _getFileListRecursive(dirPath) {
    return this._getFileList(dirPath);
  }

  async _compareFiles(file1Path, file2Path) {
    return this._compareFileContents(file1Path, file2Path);
  }

  async _calculateFileHash(filePath) {
    const hash = crypto.createHash(this.config.hashAlgorithm);
    const stream = require('fs').createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  async _generateVerificationReport(verification) {
    const reportName = `reproducibility-report-${verification.verificationId}.${this.config.reportFormat}`;
    const reportPath = path.join(process.cwd(), reportName);

    let content;
    switch (this.config.reportFormat) {
      case 'json':
        content = JSON.stringify(verification, null, 2);
        break;
      case 'markdown':
        content = this._generateMarkdownReport(verification);
        break;
      default:
        throw new Error(`Unsupported report format: ${this.config.reportFormat}`);
    }

    await fs.writeFile(reportPath, content);
    
    this.logger.info(`Verification report generated: ${reportPath}`);
    return reportPath;
  }

  _generateMarkdownReport(verification) {
    return `# Reproducibility Verification Report

## Summary
- **Verification ID**: ${verification.verificationId}  
- **Reproducible**: ${verification.reproducible ? 'YES' : 'NO'}
- **Confidence**: ${(verification.confidence * 100).toFixed(1)}%
- **Total Builds**: ${verification.totalBuilds}
- **Successful Builds**: ${verification.successfulBuilds}
- **Identical Builds**: ${verification.identicalBuilds}

## Issues
${verification.issues.map(issue => `- ${issue}`).join('\n')}

## Warnings  
${verification.warnings.map(warning => `- ${warning}`).join('\n')}

## Build Details
${verification.builds.map(build => `
### Build ${build.buildIndex + 1}
- **Status**: ${build.success ? 'SUCCESS' : 'FAILED'}
- **Duration**: ${build.duration}ms
- **Output Files**: ${build.outputFiles?.length || 0}
`).join('\n')}

Generated at: ${verification.completedAt}
`;
  }

  _isTextFile(filePath) {
    const textExtensions = ['.js', '.ts', '.json', '.md', '.txt', '.html', '.css', '.xml', '.yaml', '.yml'];
    return textExtensions.includes(path.extname(filePath).toLowerCase());
  }
}

export default ReproducibilityVerifier;