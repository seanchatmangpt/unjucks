/**
 * Git-First Workflow Integration
 * 
 * Integrates deterministic Office/LaTeX processing with git-first workflows
 * for version control, blob generation, and artifact tracking.
 * 
 * @module git-integration
 * @version 1.0.0
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { promisify } from 'util';

/**
 * Git integration for Office/LaTeX processing
 */
export class GitIntegration {
  constructor(options = {}) {
    this.options = {
      repoPath: options.repoPath || process.cwd(),
      enableAutoCommit: options.enableAutoCommit || false,
      commitMessageTemplate: options.commitMessageTemplate || 'Generated: {filename}',
      branchPrefix: options.branchPrefix || 'kgen/',
      enableBlobGeneration: true,
      trackArtifacts: true,
      ...options
    };
  }

  /**
   * Execute git command
   * 
   * @param {Array<string>} args - Git command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   */
  async execGit(args, options = {}) {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: this.options.repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code
          });
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
    });
  }

  /**
   * Generate git blob for document content
   * 
   * @param {Buffer} content - Document content
   * @returns {Promise<Object>} Blob generation result
   */
  async generateBlob(content) {
    try {
      // Create temporary file for git hash-object
      const tempPath = `/tmp/kgen-blob-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
      await fs.writeFile(tempPath, content);
      
      try {
        // Use git hash-object to generate blob
        const result = await this.execGit(['hash-object', '--stdin'], {
          input: content
        });

        // Also calculate direct SHA-1 for verification
        const directHash = this.calculateGitHash(content);

        return {
          blobHash: result.stdout,
          directHash,
          verified: result.stdout === directHash,
          size: content.length
        };
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      // Fallback to direct calculation if git is not available
      return {
        blobHash: this.calculateGitHash(content),
        directHash: this.calculateGitHash(content),
        verified: true,
        size: content.length,
        fallback: true
      };
    }
  }

  /**
   * Calculate git-style SHA-1 hash
   * 
   * @param {Buffer} content - Content to hash
   * @returns {string} Git-style SHA-1 hash
   */
  calculateGitHash(content) {
    // Git prefixes content with "blob <size>\0"
    const header = Buffer.from(`blob ${content.length}\0`);
    const combined = Buffer.concat([header, content]);
    
    return crypto.createHash('sha1').update(combined).digest('hex');
  }

  /**
   * Process template with git integration
   * 
   * @param {Object} processor - Document processor
   * @param {string} templatePath - Template path
   * @param {Object} context - Template context
   * @param {string} outputPath - Output path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with git integration
   */
  async processWithGit(processor, templatePath, context, outputPath, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    // Get current git state
    const gitState = await this.getGitState();
    
    // Process template
    const result = await processor.processTemplate(templatePath, context, outputPath, options);
    
    if (result.success) {
      // Read generated document
      const documentBuffer = await fs.readFile(outputPath);
      
      // Generate git blob
      const blobResult = await this.generateBlob(documentBuffer);
      
      // Track artifact if enabled
      if (this.options.trackArtifacts) {
        await this.trackArtifact({
          templatePath,
          outputPath,
          context: this.sanitizeContext(context),
          blobHash: blobResult.blobHash,
          processingResult: result,
          gitState,
          processedAt: this.getDeterministicDate().toISOString()
        });
      }
      
      // Auto-commit if enabled
      if (this.options.enableAutoCommit) {
        await this.autoCommit(outputPath, templatePath, blobResult);
      }
      
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      return {
        ...result,
        git: {
          blobHash: blobResult.blobHash,
          verified: blobResult.verified,
          gitState,
          artifactTracked: this.options.trackArtifacts,
          autoCommitted: this.options.enableAutoCommit,
          processingTime
        }
      };
    }
    
    return result;
  }

  /**
   * Get current git repository state
   * 
   * @returns {Promise<Object>} Git state information
   */
  async getGitState() {
    try {
      const [headResult, statusResult, branchResult] = await Promise.allSettled([
        this.execGit(['rev-parse', 'HEAD']),
        this.execGit(['status', '--porcelain']),
        this.execGit(['branch', '--show-current'])
      ]);

      return {
        head: headResult.status === 'fulfilled' ? headResult.value.stdout : null,
        branch: branchResult.status === 'fulfilled' ? branchResult.value.stdout : null,
        dirty: statusResult.status === 'fulfilled' && statusResult.value.stdout.length > 0,
        status: statusResult.status === 'fulfilled' ? statusResult.value.stdout : null
      };
    } catch (error) {
      return {
        head: null,
        branch: null,
        dirty: true,
        status: null,
        error: error.message
      };
    }
  }

  /**
   * Track artifact in git-compatible format
   * 
   * @param {Object} artifactData - Artifact tracking data
   * @returns {Promise<void>}
   */
  async trackArtifact(artifactData) {
    const artifactDir = `${this.options.repoPath}/.kgen/artifacts`;
    await fs.mkdir(artifactDir, { recursive: true });
    
    const artifactFile = `${artifactDir}/${artifactData.blobHash}.json`;
    
    const artifact = {
      version: '1.0.0',
      type: 'kgen-artifact',
      ...artifactData
    };
    
    await fs.writeFile(artifactFile, JSON.stringify(artifact, null, 2));
  }

  /**
   * Auto-commit generated document
   * 
   * @param {string} outputPath - Output file path
   * @param {string} templatePath - Template file path
   * @param {Object} blobResult - Blob generation result
   * @returns {Promise<Object>} Commit result
   */
  async autoCommit(outputPath, templatePath, blobResult) {
    try {
      // Stage the output file
      await this.execGit(['add', outputPath]);
      
      // Generate commit message
      const filename = outputPath.split('/').pop();
      const commitMessage = this.options.commitMessageTemplate
        .replace('{filename}', filename)
        .replace('{template}', templatePath)
        .replace('{blob}', blobResult.blobHash.substring(0, 8));
      
      // Commit
      const commitResult = await this.execGit(['commit', '-m', commitMessage]);
      
      return {
        success: true,
        commitHash: commitResult.stdout.match(/\[.+\s([a-f0-9]+)\]/)?.[1],
        message: commitMessage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create branch for processing
   * 
   * @param {string} branchName - Branch name (will be prefixed)
   * @returns {Promise<Object>} Branch creation result
   */
  async createProcessingBranch(branchName) {
    const fullBranchName = `${this.options.branchPrefix}${branchName}`;
    
    try {
      await this.execGit(['checkout', '-b', fullBranchName]);
      
      return {
        success: true,
        branchName: fullBranchName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        branchName: fullBranchName
      };
    }
  }

  /**
   * Switch back to main branch and optionally merge
   * 
   * @param {string} processingBranch - Processing branch to merge from
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Merge result
   */
  async mergeProcessingBranch(processingBranch, options = {}) {
    const { deleteBranch = true, mainBranch = 'main' } = options;
    
    try {
      // Switch to main branch
      await this.execGit(['checkout', mainBranch]);
      
      // Merge processing branch
      await this.execGit(['merge', processingBranch, '--no-ff']);
      
      // Delete processing branch if requested
      if (deleteBranch) {
        await this.execGit(['branch', '-d', processingBranch]);
      }
      
      return {
        success: true,
        merged: true,
        deleted: deleteBranch
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        merged: false,
        deleted: false
      };
    }
  }

  /**
   * Generate provenance information for git
   * 
   * @param {Object} processingResult - Processing result
   * @returns {Promise<Object>} Provenance information
   */
  async generateProvenance(processingResult) {
    const gitState = await this.getGitState();
    
    return {
      version: '1.0.0',
      type: 'kgen-provenance',
      timestamp: this.getDeterministicDate().toISOString(),
      generator: {
        name: 'kgen',
        version: '0.1.0'
      },
      git: gitState,
      processing: {
        deterministic: processingResult.deterministic,
        reproducible: processingResult.reproducible,
        contentHash: processingResult.contentHash,
        metrics: processingResult.metrics
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * Store provenance in git notes
   * 
   * @param {string} commitHash - Target commit hash
   * @param {Object} provenance - Provenance data
   * @returns {Promise<Object>} Storage result
   */
  async storeProvenanceInNotes(commitHash, provenance) {
    try {
      const provenanceJson = JSON.stringify(provenance, null, 2);
      
      // Add git note
      await this.execGit(['notes', 'add', '-m', provenanceJson, commitHash]);
      
      return {
        success: true,
        commitHash,
        noteAdded: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        commitHash
      };
    }
  }

  /**
   * Retrieve provenance from git notes
   * 
   * @param {string} commitHash - Target commit hash
   * @returns {Promise<Object>} Retrieved provenance
   */
  async retrieveProvenanceFromNotes(commitHash) {
    try {
      const result = await this.execGit(['notes', 'show', commitHash]);
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`Failed to retrieve provenance: ${error.message}`);
    }
  }

  /**
   * List all artifacts tracked in repository
   * 
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of tracked artifacts
   */
  async listTrackedArtifacts(options = {}) {
    const { pattern = null, since = null } = options;
    const artifacts = [];
    
    try {
      const artifactDir = `${this.options.repoPath}/.kgen/artifacts`;
      const files = await fs.readdir(artifactDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const artifactPath = `${artifactDir}/${file}`;
          const content = await fs.readFile(artifactPath, 'utf8');
          const artifact = JSON.parse(content);
          
          // Apply filters
          if (pattern && !new RegExp(pattern).test(artifact.templatePath)) {
            continue;
          }
          
          if (since && new Date(artifact.processedAt) < new Date(since)) {
            continue;
          }
          
          artifacts.push(artifact);
        } catch (error) {
          console.warn(`Failed to parse artifact ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to list artifacts: ${error.message}`);
    }
    
    return artifacts.sort((a, b) => 
      new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
    );
  }

  /**
   * Sanitize context for git storage (remove functions, etc.)
   * 
   * @param {Object} context - Template context
   * @returns {Object} Sanitized context
   */
  sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value !== 'function') {
        if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (value && typeof value === 'object') {
          sanitized[key] = this.sanitizeContext(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Verify git repository integrity
   * 
   * @returns {Promise<Object>} Integrity check result
   */
  async verifyIntegrity() {
    try {
      const fsckResult = await this.execGit(['fsck', '--full']);
      
      return {
        valid: true,
        output: fsckResult.stdout
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

/**
 * Create Git integration with default settings
 * 
 * @param {Object} options - Git integration options
 * @returns {GitIntegration} Configured Git integration
 */
export function createGitIntegration(options = {}) {
  return new GitIntegration(options);
}

export default GitIntegration;