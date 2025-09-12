/**
 * Git-First Operations Module for KGEN
 * 
 * Implements git-first workflow using isomorphic-git and simple-git for:
 * - Blob-based content addressing
 * - Git notes for provenance storage
 * - Packfile handling for reproducibility
 * - Windows FS performance optimizations
 */

import git from 'isomorphic-git';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

export class GitOperations {
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.fs = fs;
    this.performance = {
      operationsCount: 0,
      totalTime: 0,
      lastOperation: null
    };
    
    // Git configuration
    this.gitConfig = {
      author: {
        name: options.author?.name || 'KGEN System',
        email: options.author?.email || 'kgen@system.local'
      },
      ref: options.ref || 'refs/heads/main'
    };

    // Performance optimizations for Windows
    this.windowsOptimizations = {
      enableHardlinkCache: options.enableHardlinkCache !== false,
      cacheSize: options.cacheSize || 1000,
      cacheDir: options.cacheDir || path.join(this.repoPath, '.git', 'kgen-cache')
    };

    // Git notes configuration for provenance
    this.notesRef = options.notesRef || 'refs/notes/kgen-provenance';
    
    // Initialize simple-git instance
    this.simpleGit = simpleGit(this.repoPath);
  }

  /**
   * Initialize git repository if not exists and setup KGEN-specific refs
   */
  async initialize() {
    const startTime = performance.now();
    
    try {
      // Check if git repository exists
      const isRepo = await this.isGitRepository();
      
      if (!isRepo) {
        await git.init({
          fs: this.fs,
          dir: this.repoPath,
          defaultBranch: 'main'
        });
      }

      // Setup KGEN-specific git notes namespace
      await this.initializeNotesRef();
      
      // Setup performance cache directory
      if (this.windowsOptimizations.enableHardlinkCache) {
        await fs.ensureDir(this.windowsOptimizations.cacheDir);
      }

      this._recordPerformance('initialize', startTime);
      
      return {
        success: true,
        repoPath: this.repoPath,
        isNewRepo: !isRepo,
        notesRef: this.notesRef
      };
    } catch (error) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if directory is a git repository
   */
  async isGitRepository() {
    try {
      const gitDir = path.join(this.repoPath, '.git');
      return await fs.pathExists(gitDir);
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize git notes reference for provenance data
   */
  async initializeNotesRef() {
    try {
      // Check if notes ref already exists
      const refs = await git.listBranches({
        fs: this.fs,
        dir: this.repoPath
      });
      
      // Create empty notes ref if it doesn't exist
      if (!refs.includes(this.notesRef)) {
        // Create initial empty commit for notes
        const emptyTreeSha = await git.writeTree({
          fs: this.fs,
          dir: this.repoPath,
          tree: []
        });
        
        await git.writeRef({
          fs: this.fs,
          dir: this.repoPath,
          ref: this.notesRef,
          value: emptyTreeSha
        });
      }
    } catch (error) {
      // Notes ref initialization is optional
      console.warn(`Warning: Could not initialize notes ref: ${error.message}`);
    }
  }

  /**
   * Create git blob from content with deterministic SHA
   */
  async createBlob(content) {
    const startTime = performance.now();
    
    try {
      // Ensure content is string or buffer
      const blobContent = typeof content === 'string' ? content : content.toString();
      
      // Create git blob
      const blobSha = await git.writeBlob({
        fs: this.fs,
        dir: this.repoPath,
        blob: blobContent
      });

      this._recordPerformance('createBlob', startTime);

      return {
        sha: blobSha,
        size: blobContent.length,
        type: 'blob'
      };
    } catch (error) {
      throw new Error(`Failed to create git blob: ${error.message}`);
    }
  }

  /**
   * Read git blob content by SHA
   */
  async readBlob(blobSha) {
    const startTime = performance.now();
    
    try {
      const { blob } = await git.readBlob({
        fs: this.fs,
        dir: this.repoPath,
        oid: blobSha
      });

      this._recordPerformance('readBlob', startTime);

      return {
        content: blob,
        sha: blobSha,
        size: blob.length
      };
    } catch (error) {
      throw new Error(`Failed to read git blob ${blobSha}: ${error.message}`);
    }
  }

  /**
   * Store provenance data in git notes
   */
  async storeProvenance(objectSha, provenanceData) {
    const startTime = performance.now();
    
    try {
      // Convert provenance data to JSON
      const provenanceJson = JSON.stringify(provenanceData, null, 2);
      
      // Create blob for provenance data
      const provenanceBlobSha = await git.writeBlob({
        fs: this.fs,
        dir: this.repoPath,
        blob: provenanceJson
      });

      // Add note using simple-git for better notes handling
      await this.simpleGit.raw([
        'notes', 
        '--ref', this.notesRef,
        'add', 
        '-f',
        '-m', provenanceJson,
        objectSha
      ]);

      this._recordPerformance('storeProvenance', startTime);

      return {
        success: true,
        objectSha,
        provenanceSha: provenanceBlobSha,
        notesRef: this.notesRef
      };
    } catch (error) {
      throw new Error(`Failed to store provenance for ${objectSha}: ${error.message}`);
    }
  }

  /**
   * Retrieve provenance data from git notes
   */
  async getProvenance(objectSha) {
    const startTime = performance.now();
    
    try {
      // Get note using simple-git
      const noteContent = await this.simpleGit.raw([
        'notes', 
        '--ref', this.notesRef,
        'show', 
        objectSha
      ]);

      this._recordPerformance('getProvenance', startTime);

      if (!noteContent || noteContent.trim() === '') {
        return null;
      }

      return {
        objectSha,
        provenance: JSON.parse(noteContent.trim()),
        notesRef: this.notesRef
      };
    } catch (error) {
      // Return null if note doesn't exist instead of throwing
      if (error.message.includes('No note found')) {
        return null;
      }
      throw new Error(`Failed to get provenance for ${objectSha}: ${error.message}`);
    }
  }

  /**
   * Generate deterministic artifact using git blobs
   */
  async generateGitArtifact(templatePath, context, options = {}) {
    const startTime = performance.now();
    
    try {
      // Read template content
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      // Create template blob
      const templateBlob = await this.createBlob(templateContent);
      
      // Create context blob
      const contextJson = JSON.stringify(context, null, 2);
      const contextBlob = await this.createBlob(contextJson);
      
      // Generate artifact content (simplified - in real implementation would use template engine)
      const artifactContent = this._renderTemplate(templateContent, context);
      
      // Create artifact blob
      const artifactBlob = await this.createBlob(artifactContent);
      
      // Create provenance data
      const provenance = {
        '@context': 'http://www.w3.org/ns/prov#',
        '@type': 'Activity',
        'prov:used': [
          {
            '@type': 'Entity',
            'kgen:templateSha': templateBlob.sha,
            'kgen:contextSha': contextBlob.sha,
            'prov:location': templatePath
          }
        ],
        'prov:generated': {
          '@type': 'Entity',
          'kgen:artifactSha': artifactBlob.sha,
          'kgen:contentType': 'application/octet-stream'
        },
        'prov:wasAssociatedWith': {
          '@type': 'Agent',
          'kgen:agent': 'KGEN-GitFirst',
          'kgen:version': '1.0.0'
        },
        'prov:startedAtTime': this.getDeterministicDate().toISOString(),
        'kgen:gitOperations': {
          templatePath,
          outputPath: options.outputPath,
          deterministic: true,
          gitFirst: true
        }
      };
      
      // Store provenance in git notes
      await this.storeProvenance(artifactBlob.sha, provenance);
      
      this._recordPerformance('generateGitArtifact', startTime);
      
      return {
        success: true,
        artifactSha: artifactBlob.sha,
        templateSha: templateBlob.sha,
        contextSha: contextBlob.sha,
        content: artifactContent,
        provenance,
        gitFirst: true
      };
    } catch (error) {
      throw new Error(`Failed to generate git artifact: ${error.message}`);
    }
  }

  /**
   * Write git blob to filesystem with git SHA as filename
   */
  async writeBlobToFile(blobSha, outputPath) {
    const startTime = performance.now();
    
    try {
      // Read blob content
      const blobData = await this.readBlob(blobSha);
      
      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));
      
      // Write to file
      await fs.writeFile(outputPath, blobData.content);
      
      // Store SHA-based reference for content addressing
      const shaPath = path.join(path.dirname(outputPath), `${blobSha.substring(0, 8)}.sha`);
      await fs.writeFile(shaPath, JSON.stringify({
        sha: blobSha,
        path: outputPath,
        size: blobData.size,
        timestamp: this.getDeterministicDate().toISOString()
      }, null, 2));
      
      this._recordPerformance('writeBlobToFile', startTime);
      
      return {
        success: true,
        outputPath,
        blobSha,
        shaPath,
        size: blobData.size
      };
    } catch (error) {
      throw new Error(`Failed to write blob ${blobSha} to file: ${error.message}`);
    }
  }

  /**
   * Create packfile for reproducible distribution
   */
  async createPackfile(objects, outputPath) {
    const startTime = performance.now();
    
    try {
      // Use simple-git to create packfile
      const packName = `kgen-${this.getDeterministicTimestamp()}`;
      const packDir = path.join(this.repoPath, '.git', 'objects', 'pack');
      
      await fs.ensureDir(packDir);
      
      // Create pack using git pack-objects
      await this.simpleGit.raw([
        'pack-objects',
        path.join(packDir, packName),
        ...objects
      ]);
      
      const packfilePath = path.join(packDir, `${packName}.pack`);
      const indexPath = path.join(packDir, `${packName}.idx`);
      
      // Copy to desired output location if specified
      if (outputPath) {
        await fs.copy(packfilePath, outputPath);
      }
      
      this._recordPerformance('createPackfile', startTime);
      
      return {
        success: true,
        packfilePath: outputPath || packfilePath,
        indexPath,
        objects: objects.length
      };
    } catch (error) {
      throw new Error(`Failed to create packfile: ${error.message}`);
    }
  }

  /**
   * Get git diff for semantic change detection
   */
  async getSemanticDiff(sha1, sha2) {
    const startTime = performance.now();
    
    try {
      // Get diff using simple-git
      const diff = await this.simpleGit.diff([
        sha1, 
        sha2, 
        '--no-color',
        '--no-prefix'
      ]);
      
      // Parse diff for semantic analysis
      const lines = diff.split('\n');
      const changes = {
        added: 0,
        removed: 0,
        modified: 0,
        hunks: []
      };
      
      let currentHunk = null;
      for (const line of lines) {
        if (line.startsWith('@@')) {
          if (currentHunk) {
            changes.hunks.push(currentHunk);
          }
          currentHunk = {
            header: line,
            additions: [],
            deletions: []
          };
        } else if (line.startsWith('+') && currentHunk) {
          changes.added++;
          currentHunk.additions.push(line.substring(1));
        } else if (line.startsWith('-') && currentHunk) {
          changes.removed++;
          currentHunk.deletions.push(line.substring(1));
        }
      }
      
      if (currentHunk) {
        changes.hunks.push(currentHunk);
      }
      
      this._recordPerformance('getSemanticDiff', startTime);
      
      return {
        sha1,
        sha2,
        changes,
        semantic: this._analyzeSemanticChanges(changes)
      };
    } catch (error) {
      throw new Error(`Failed to get semantic diff: ${error.message}`);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const avgTime = this.performance.operationsCount > 0 
      ? this.performance.totalTime / this.performance.operationsCount 
      : 0;
      
    return {
      operationsCount: this.performance.operationsCount,
      totalTime: Math.round(this.performance.totalTime * 100) / 100,
      averageTime: Math.round(avgTime * 100) / 100,
      lastOperation: this.performance.lastOperation,
      performanceTarget: {
        coldStart: '≤2s',
        p95RenderTime: '≤10ms'
      }
    };
  }

  /**
   * Simple template rendering (placeholder - would use proper template engine)
   */
  _renderTemplate(template, context) {
    let content = template;
    
    // Simple variable substitution
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
    
    return content;
  }

  /**
   * Analyze semantic changes in diff
   */
  _analyzeSemanticChanges(changes) {
    const semanticChanges = {
      structuralChanges: 0,
      contentChanges: 0,
      metadataChanges: 0,
      impactScore: 0
    };
    
    for (const hunk of changes.hunks) {
      // Simple heuristic for semantic analysis
      for (const addition of hunk.additions) {
        if (addition.trim().includes('{') || addition.trim().includes('}')) {
          semanticChanges.structuralChanges++;
        } else if (addition.trim().startsWith('#') || addition.trim().startsWith('//')) {
          semanticChanges.metadataChanges++;
        } else {
          semanticChanges.contentChanges++;
        }
      }
    }
    
    // Calculate impact score
    semanticChanges.impactScore = (
      semanticChanges.structuralChanges * 3 +
      semanticChanges.contentChanges * 2 +
      semanticChanges.metadataChanges * 1
    ) / Math.max(1, changes.hunks.length);
    
    return semanticChanges;
  }

  /**
   * Record performance metrics
   */
  _recordPerformance(operation, startTime) {
    const duration = performance.now() - startTime;
    this.performance.operationsCount++;
    this.performance.totalTime += duration;
    this.performance.lastOperation = {
      operation,
      duration: Math.round(duration * 100) / 100,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }
}

export default GitOperations;