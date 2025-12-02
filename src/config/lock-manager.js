/**
 * Lock File Manager
 * 
 * Implements git-first lock semantics with:
 * - Deterministic lock file generation
 * - Template and rule hash tracking
 * - Generation-only updates (no user prompts)
 * - Git integration for state tracking
 * - Baseline comparison for drift detection
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, join, relative, dirname } from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdirSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Lock file version for compatibility tracking
 */
const LOCK_VERSION = '2.0.0';

/**
 * Default lock file name
 */
const LOCK_FILE_NAME = 'kgen.lock.json';

/**
 * File patterns to include in lock tracking
 */
const DEFAULT_PATTERNS = {
  templates: ['templates/**/*', '_templates/**/*'],
  rules: ['rules/**/*.n3', 'rules/**/*.ttl'],
  graphs: ['**/*.ttl', '**/*.n3', '**/*.jsonld'],
  configs: ['kgen.config.*', '.kgenrc.*']
};

/**
 * Lock file manager class
 */
export class LockManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.lockPath = options.lockPath || join(this.projectRoot, LOCK_FILE_NAME);
    this.patterns = { ...DEFAULT_PATTERNS, ...options.patterns };
    this.includeContent = options.includeContent || false;
  }

  /**
   * Generate lock file from current project state
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated lock file content
   */
  async generate(options = {}) {
    const config = options.config || {};
    const forceUpdate = options.force || false;
    
    // Get Git information
    const gitInfo = await this.getGitInfo();
    
    // Scan project files
    const files = await this.scanProjectFiles();
    
    // Calculate integrity hashes
    const integrity = this.calculateIntegrity(files);
    
    // Build lock file structure
    const lockFile = {
      version: LOCK_VERSION,
      timestamp: this.getDeterministicTimestamp(),
      project: {
        name: config.project?.name || 'unnamed-project',
        version: config.project?.version || '1.0.0',
        root: this.projectRoot
      },
      git: gitInfo,
      source: {
        config: this.getConfigInfo(config),
        patterns: this.patterns
      },
      dependencies: this.extractDependencies(files),
      templates: this.categorizeFiles(files, 'templates'),
      rules: this.categorizeFiles(files, 'rules'),
      graphs: this.categorizeFiles(files, 'graphs'),
      artifacts: this.categorizeFiles(files, 'artifacts'),
      integrity,
      metadata: {
        generatedBy: 'kgen-lock-manager',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    // Validate lock file structure
    this.validateLockFile(lockFile);
    
    return lockFile;
  }

  /**
   * Update lock file (only on successful generation)
   * @param {Object} lockContent - Lock file content
   * @param {Object} options - Update options
   * @returns {Promise<void>}
   */
  async update(lockContent, options = {}) {
    const backup = options.backup !== false;
    
    // Create backup if lock file exists
    if (backup && existsSync(this.lockPath)) {
      await this.createBackup();
    }
    
    // Ensure directory exists
    mkdirSync(dirname(this.lockPath), { recursive: true });
    
    // Write lock file atomically
    const tempPath = `${this.lockPath}.tmp`;
    const content = JSON.stringify(lockContent, null, 2) + '\n';
    
    writeFileSync(tempPath, content, 'utf8');
    
    // Atomic move
    if (process.platform === 'win32') {
      // Windows doesn't support atomic moves, so delete first
      if (existsSync(this.lockPath)) {
        require('fs').unlinkSync(this.lockPath);
      }
    }
    require('fs').renameSync(tempPath, this.lockPath);
    
    // Track in Git if enabled
    if (options.gitAdd !== false) {
      await this.addToGit();
    }
  }

  /**
   * Load existing lock file
   * @returns {Promise<Object|null>} Lock file content or null if not found
   */
  async load() {
    if (!existsSync(this.lockPath)) {
      return null;
    }
    
    try {
      const content = readFileSync(this.lockPath, 'utf8');
      const lockFile = JSON.parse(content);
      
      // Validate version compatibility
      if (!this.isCompatibleVersion(lockFile.version)) {
        throw new Error(`Incompatible lock file version: ${lockFile.version}. Expected: ${LOCK_VERSION}`);
      }
      
      return lockFile;
    } catch (error) {
      throw new Error(`Failed to load lock file: ${error.message}`);
    }
  }

  /**
   * Scan project files according to patterns
   * @returns {Promise<Map>} Map of file paths to file info
   */
  async scanProjectFiles() {
    const files = new Map();
    
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          cwd: this.projectRoot,
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          absolute: true,
          nodir: true
        });
        
        for (const filePath of matches) {
          if (!files.has(filePath)) {
            const info = await this.getFileInfo(filePath, category);
            files.set(filePath, info);
          } else {
            // Add category to existing file
            files.get(filePath).categories.add(category);
          }
        }
      }
    }
    
    return files;
  }

  /**
   * Get file information including hash and metadata
   * @param {string} filePath - Absolute file path
   * @param {string} category - File category
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(filePath, category) {
    const stats = statSync(filePath);
    const content = readFileSync(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    const relativePath = relative(this.projectRoot, filePath);
    
    const info = {
      path: relativePath,
      absolutePath: filePath,
      hash,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      categories: new Set([category])
    };
    
    // Include content if requested (for small files)
    if (this.includeContent && stats.size < 10240) { // 10KB limit
      info.content = content.toString('utf8');
    }
    
    return info;
  }

  /**
   * Categorize files by type
   * @param {Map} files - All scanned files
   * @param {string} category - Category to extract
   * @returns {Object} Categorized files
   */
  categorizeFiles(files, category) {
    const result = {};
    
    for (const [filePath, info] of files) {
      if (info.categories.has(category)) {
        result[info.path] = {
          hash: info.hash,
          size: info.size,
          modified: info.modified,
          ...(info.content && { content: info.content })
        };
      }
    }
    
    return result;
  }

  /**
   * Calculate integrity hashes for different components
   * @param {Map} files - All scanned files
   * @returns {Object} Integrity hashes
   */
  calculateIntegrity(files) {
    const categories = ['templates', 'rules', 'graphs', 'configs'];
    const integrity = {
      combined: '',
      components: {}
    };
    
    // Calculate per-category hashes
    for (const category of categories) {
      const categoryFiles = [];
      
      for (const [filePath, info] of files) {
        if (info.categories.has(category)) {
          categoryFiles.push({ path: info.path, hash: info.hash });
        }
      }
      
      // Sort by path for deterministic ordering
      categoryFiles.sort((a, b) => a.path.localeCompare(b.path));
      
      const categoryContent = categoryFiles.map(f => `${f.path}:${f.hash}`).join('|');
      integrity.components[category] = categoryContent ? 
        createHash('sha256').update(categoryContent).digest('hex') : 
        null;
    }
    
    // Calculate combined hash
    const combinedContent = Object.values(integrity.components)
      .filter(Boolean)
      .join('|');
    integrity.combined = createHash('sha256').update(combinedContent).digest('hex');
    
    return integrity;
  }

  /**
   * Extract dependency information from files
   * @param {Map} files - All scanned files
   * @returns {Object} Dependencies
   */
  extractDependencies(files) {
    const dependencies = {
      templates: {},
      rules: {},
      external: {}
    };
    
    // Analyze template dependencies
    for (const [filePath, info] of files) {
      if (info.categories.has('templates')) {
        // TODO: Parse template files for includes/extends
        dependencies.templates[info.path] = [];
      }
      
      if (info.categories.has('rules')) {
        // TODO: Parse N3 files for imports
        dependencies.rules[info.path] = [];
      }
    }
    
    return dependencies;
  }

  /**
   * Get configuration information
   * @param {Object} config - Configuration object
   * @returns {Object} Config info for lock file
   */
  getConfigInfo(config) {
    return {
      hash: config._meta?.hash || null,
      path: config._meta?.configPath || null,
      environment: config._meta?.environment || 'development',
      loadedAt: config._meta?.loadedAt || new Date().toISOString()
    };
  }

  /**
   * Get Git information for the project
   * @returns {Promise<Object>} Git information
   */
  async getGitInfo() {
    try {
      const [commit, branch, status] = await Promise.all([
        execAsync('git rev-parse HEAD', { cwd: this.projectRoot }),
        execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectRoot }),
        execAsync('git status --porcelain', { cwd: this.projectRoot })
      ]);
      
      return {
        commit: commit.stdout.trim(),
        branch: branch.stdout.trim(),
        dirty: status.stdout.trim().length > 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        commit: null,
        branch: null,
        dirty: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get deterministic timestamp for reproducible builds
   * @returns {string} ISO timestamp
   */
  getDeterministicTimestamp() {
    // Use SOURCE_DATE_EPOCH if available (for reproducible builds)
    const epoch = process.env.SOURCE_DATE_EPOCH;
    if (epoch) {
      return new Date(parseInt(epoch) * 1000).toISOString();
    }
    
    // Otherwise use current time
    return new Date().toISOString();
  }

  /**
   * Validate lock file structure
   * @param {Object} lockFile - Lock file to validate
   * @throws {Error} If validation fails
   */
  validateLockFile(lockFile) {
    const required = ['version', 'timestamp', 'project', 'integrity'];
    
    for (const field of required) {
      if (!lockFile[field]) {
        throw new Error(`Lock file missing required field: ${field}`);
      }
    }
    
    if (!this.isCompatibleVersion(lockFile.version)) {
      throw new Error(`Invalid lock file version: ${lockFile.version}`);
    }
  }

  /**
   * Check if lock file version is compatible
   * @param {string} version - Version to check
   * @returns {boolean} True if compatible
   */
  isCompatibleVersion(version) {
    const [major] = version.split('.');
    const [expectedMajor] = LOCK_VERSION.split('.');
    return major === expectedMajor;
  }

  /**
   * Create backup of existing lock file
   * @returns {Promise<string>} Backup file path
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.lockPath}.backup.${timestamp}`;
    
    const content = readFileSync(this.lockPath);
    writeFileSync(backupPath, content);
    
    return backupPath;
  }

  /**
   * Add lock file to Git
   * @returns {Promise<void>}
   */
  async addToGit() {
    try {
      await execAsync(`git add "${this.lockPath}"`, { cwd: this.projectRoot });
    } catch (error) {
      // Ignore Git errors (might not be a Git repository)
    }
  }

  /**
   * Compare current state with lock file
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison result
   */
  async compare(options = {}) {
    const currentLock = await this.load();
    if (!currentLock) {
      return {
        status: 'no-lock',
        message: 'No lock file found',
        changes: []
      };
    }
    
    const newLock = await this.generate(options);
    
    // Compare integrity hashes
    const changes = [];
    
    if (currentLock.integrity.combined !== newLock.integrity.combined) {
      // Find specific changes
      for (const category of ['templates', 'rules', 'graphs']) {
        const currentHash = currentLock.integrity.components[category];
        const newHash = newLock.integrity.components[category];
        
        if (currentHash !== newHash) {
          changes.push({
            type: 'integrity',
            category,
            old: currentHash,
            new: newHash
          });
        }
      }
      
      // Compare individual files
      const currentFiles = new Set(Object.keys(currentLock.templates || {}).concat(
        Object.keys(currentLock.rules || {}),
        Object.keys(currentLock.graphs || {})
      ));
      
      const newFiles = new Set(Object.keys(newLock.templates || {}).concat(
        Object.keys(newLock.rules || {}),
        Object.keys(newLock.graphs || {})
      ));
      
      // Added files
      for (const file of newFiles) {
        if (!currentFiles.has(file)) {
          changes.push({ type: 'added', file });
        }
      }
      
      // Removed files
      for (const file of currentFiles) {
        if (!newFiles.has(file)) {
          changes.push({ type: 'removed', file });
        }
      }
      
      // Modified files
      for (const file of currentFiles) {
        if (newFiles.has(file)) {
          const currentFileInfo = this.getFileFromLock(currentLock, file);
          const newFileInfo = this.getFileFromLock(newLock, file);
          
          if (currentFileInfo?.hash !== newFileInfo?.hash) {
            changes.push({ 
              type: 'modified', 
              file,
              oldHash: currentFileInfo?.hash,
              newHash: newFileInfo?.hash
            });
          }
        }
      }
    }
    
    return {
      status: changes.length > 0 ? 'drift' : 'clean',
      message: changes.length > 0 ? 'Drift detected' : 'No changes detected',
      changes,
      currentLock,
      newLock
    };
  }

  /**
   * Get file info from lock file
   * @param {Object} lockFile - Lock file content
   * @param {string} filePath - File path to find
   * @returns {Object|null} File info or null
   */
  getFileFromLock(lockFile, filePath) {
    for (const category of ['templates', 'rules', 'graphs', 'artifacts']) {
      if (lockFile[category] && lockFile[category][filePath]) {
        return lockFile[category][filePath];
      }
    }
    return null;
  }
}

/**
 * Default lock manager instance
 */
export const lockManager = new LockManager();

/**
 * Convenience function to generate lock file
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Lock file content
 */
export async function generateLockFile(options = {}) {
  const manager = new LockManager(options);
  return manager.generate(options);
}

/**
 * Convenience function to update lock file
 * @param {Object} lockContent - Lock file content
 * @param {Object} options - Update options
 * @returns {Promise<void>}
 */
export async function updateLockFile(lockContent, options = {}) {
  const manager = new LockManager(options);
  return manager.update(lockContent, options);
}
