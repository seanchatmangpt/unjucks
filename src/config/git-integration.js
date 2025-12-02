/**
 * Git Integration for Config and Lock Management
 * 
 * Provides Git-aware functionality for:
 * - Tracking configuration changes
 * - Lock file version control
 * - Commit-based drift detection
 * - Branch-aware configuration
 * - Pre-commit hooks for validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

/**
 * Git integration class for config and lock management
 */
export class GitIntegration {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.lockFileName = options.lockFileName || 'kgen.lock.json';
    this.configPatterns = options.configPatterns || [
      'kgen.config.*',
      '.kgenrc.*',
      'kgen.lock.json'
    ];
  }

  /**
   * Check if project is a Git repository
   * @returns {Promise<boolean>} True if Git repository
   */
  async isGitRepository() {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.projectRoot });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current Git status
   * @returns {Promise<Object>} Git status information
   */
  async getStatus() {
    if (!await this.isGitRepository()) {
      return {
        isRepo: false,
        error: 'Not a Git repository'
      };
    }

    try {
      const [commit, branch, status, tags] = await Promise.all([
        execAsync('git rev-parse HEAD', { cwd: this.projectRoot }),
        execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectRoot }),
        execAsync('git status --porcelain', { cwd: this.projectRoot }),
        this.getTags().catch(() => ({ stdout: '' }))
      ]);

      const dirty = status.stdout.trim().length > 0;
      const configFiles = await this.getTrackedConfigFiles();
      
      return {
        isRepo: true,
        commit: commit.stdout.trim(),
        shortCommit: commit.stdout.trim().substring(0, 8),
        branch: branch.stdout.trim(),
        dirty,
        tags: tags.stdout.trim().split('\n').filter(Boolean),
        configFiles,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        isRepo: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get Git tags for current commit
   * @returns {Promise<Object>} Tags information
   */
  async getTags() {
    return execAsync('git tag --points-at HEAD', { cwd: this.projectRoot });
  }

  /**
   * Track configuration files in Git
   * @param {Array} files - Additional files to track
   * @returns {Promise<Object>} Tracking result
   */
  async trackConfigFiles(files = []) {
    if (!await this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a Git repository'
      };
    }

    const allFiles = [...this.configPatterns, ...files];
    const tracked = [];
    const errors = [];

    for (const filePattern of allFiles) {
      try {
        await execAsync(`git add "${filePattern}"`, { cwd: this.projectRoot });
        tracked.push(filePattern);
      } catch (error) {
        // File might not exist, which is okay
        if (!error.message.includes('pathspec') && !error.message.includes('did not match')) {
          errors.push({ file: filePattern, error: error.message });
        }
      }
    }

    return {
      success: errors.length === 0,
      tracked,
      errors
    };
  }

  /**
   * Get tracked configuration files
   * @returns {Promise<Array>} List of tracked config files
   */
  async getTrackedConfigFiles() {
    if (!await this.isGitRepository()) {
      return [];
    }

    try {
      const result = await execAsync('git ls-files', { cwd: this.projectRoot });
      const allFiles = result.stdout.trim().split('\n');
      
      return allFiles.filter(file => 
        this.configPatterns.some(pattern => 
          file.match(pattern.replace(/\*/g, '.*'))
        )
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get configuration changes since last commit
   * @returns {Promise<Object>} Configuration changes
   */
  async getConfigChanges() {
    if (!await this.isGitRepository()) {
      return {
        hasChanges: false,
        error: 'Not a Git repository'
      };
    }

    try {
      // Get changes for config files
      const changes = { modified: [], added: [], deleted: [] };
      
      for (const pattern of this.configPatterns) {
        try {
          // Check staged and unstaged changes
          const [staged, unstaged] = await Promise.all([
            execAsync(`git diff --cached --name-status -- "${pattern}"`, { cwd: this.projectRoot }),
            execAsync(`git diff --name-status -- "${pattern}"`, { cwd: this.projectRoot })
          ]);
          
          this.parseGitDiffOutput(staged.stdout, changes);
          this.parseGitDiffOutput(unstaged.stdout, changes);
        } catch (error) {
          // Pattern might not match any files
        }
      }
      
      const hasChanges = Object.values(changes).some(arr => arr.length > 0);
      
      return {
        hasChanges,
        changes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        hasChanges: false,
        error: error.message
      };
    }
  }

  /**
   * Parse Git diff output to extract changes
   * @param {string} output - Git diff output
   * @param {Object} changes - Changes object to populate
   */
  parseGitDiffOutput(output, changes) {
    const lines = output.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      const [status, file] = line.split('\t');
      
      switch (status) {
        case 'M':
          if (!changes.modified.includes(file)) {
            changes.modified.push(file);
          }
          break;
        case 'A':
          if (!changes.added.includes(file)) {
            changes.added.push(file);
          }
          break;
        case 'D':
          if (!changes.deleted.includes(file)) {
            changes.deleted.push(file);
          }
          break;
      }
    }
  }

  /**
   * Get lock file history from Git
   * @param {number} limit - Number of commits to retrieve
   * @returns {Promise<Array>} Lock file history
   */
  async getLockFileHistory(limit = 10) {
    if (!await this.isGitRepository()) {
      return [];
    }

    try {
      const lockPath = join(this.projectRoot, this.lockFileName);
      const relativePath = relative(this.projectRoot, lockPath);
      
      const result = await execAsync(
        `git log --oneline -n ${limit} --follow -- "${relativePath}"`,
        { cwd: this.projectRoot }
      );
      
      const commits = result.stdout.trim().split('\n').filter(Boolean);
      const history = [];
      
      for (const commit of commits) {
        const [hash, ...messageParts] = commit.split(' ');
        const message = messageParts.join(' ');
        
        try {
          // Get commit details
          const detailResult = await execAsync(
            `git show --format="%ai|%an|%ae" --name-only ${hash}`,
            { cwd: this.projectRoot }
          );
          
          const lines = detailResult.stdout.trim().split('\n');
          const [timestamp, author, email] = lines[0].split('|');
          
          history.push({
            hash,
            shortHash: hash.substring(0, 8),
            message,
            timestamp,
            author,
            email,
            files: lines.slice(2).filter(Boolean)
          });
        } catch (error) {
          // If we can't get details, just include basic info
          history.push({
            hash,
            shortHash: hash.substring(0, 8),
            message
          });
        }
      }
      
      return history;
    } catch (error) {
      return [];
    }
  }

  /**
   * Create commit with configuration changes
   * @param {string} message - Commit message
   * @param {Object} options - Commit options
   * @returns {Promise<Object>} Commit result
   */
  async commitConfigChanges(message, options = {}) {
    if (!await this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a Git repository'
      };
    }

    try {
      // Track config files first
      const trackResult = await this.trackConfigFiles();
      if (!trackResult.success && trackResult.errors.length > 0) {
        return {
          success: false,
          error: 'Failed to track config files',
          details: trackResult.errors
        };
      }

      // Check if there are changes to commit
      const changes = await this.getConfigChanges();
      if (!changes.hasChanges) {
        return {
          success: true,
          message: 'No configuration changes to commit',
          changes: changes.changes
        };
      }

      // Create commit
      const commitMessage = message || 'Update KGEN configuration and lock files';
      const result = await execAsync(
        `git commit -m "${commitMessage}"${options.allowEmpty ? ' --allow-empty' : ''}`,
        { cwd: this.projectRoot }
      );

      // Get new commit hash
      const hashResult = await execAsync('git rev-parse HEAD', { cwd: this.projectRoot });
      
      return {
        success: true,
        commit: hashResult.stdout.trim(),
        message: commitMessage,
        output: result.stdout.trim(),
        changes: changes.changes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Setup Git hooks for KGEN
   * @param {Object} options - Hook options
   * @returns {Promise<Object>} Setup result
   */
  async setupGitHooks(options = {}) {
    if (!await this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a Git repository'
      };
    }

    const hooksDir = join(this.projectRoot, '.git', 'hooks');
    const hooks = [];
    const errors = [];

    try {
      // Pre-commit hook for lock file validation
      if (options.preCommit !== false) {
        const preCommitPath = join(hooksDir, 'pre-commit');
        const preCommitScript = this.generatePreCommitHook();
        
        try {
          writeFileSync(preCommitPath, preCommitScript, { mode: 0o755 });
          hooks.push('pre-commit');
        } catch (error) {
          errors.push({ hook: 'pre-commit', error: error.message });
        }
      }

      // Post-merge hook for lock file updates
      if (options.postMerge !== false) {
        const postMergePath = join(hooksDir, 'post-merge');
        const postMergeScript = this.generatePostMergeHook();
        
        try {
          writeFileSync(postMergePath, postMergeScript, { mode: 0o755 });
          hooks.push('post-merge');
        } catch (error) {
          errors.push({ hook: 'post-merge', error: error.message });
        }
      }

      return {
        success: errors.length === 0,
        hooks,
        errors
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate pre-commit hook script
   * @returns {string} Hook script content
   */
  generatePreCommitHook() {
    return `#!/bin/sh
#
# KGEN Pre-commit Hook
# Validates configuration and lock files before commit
#

echo "KGEN: Validating configuration..."

# Check if lock file is up to date
if command -v kgen >/dev/null 2>&1; then
  if ! kgen drift check --quiet; then
    echo "Error: KGEN drift detected. Please update lock file with 'kgen lock generate'"
    exit 1
  fi
else
  echo "Warning: KGEN CLI not found. Skipping drift check."
fi

# Validate configuration syntax
for config_file in kgen.config.* .kgenrc.*; do
  if [ -f "$config_file" ]; then
    echo "Validating $config_file..."
    
    # Basic JSON validation for .json files
    if echo "$config_file" | grep -q '\.json$'; then
      if ! python -m json.tool "$config_file" >/dev/null 2>&1; then
        echo "Error: Invalid JSON syntax in $config_file"
        exit 1
      fi
    fi
  fi
done

echo "KGEN: Configuration validation passed"
exit 0
`;
  }

  /**
   * Generate post-merge hook script
   * @returns {string} Hook script content
   */
  generatePostMergeHook() {
    return `#!/bin/sh
#
# KGEN Post-merge Hook
# Updates lock file after merge if configuration changed
#

echo "KGEN: Checking for configuration changes..."

# Check if any config files changed in the merge
changed_files=$(git diff-tree -r --name-only --no-commit-id HEAD^ HEAD)

config_changed=false
for file in $changed_files; do
  case "$file" in
    kgen.config.*|.kgenrc.*)
      config_changed=true
      echo "Configuration file changed: $file"
      ;;
  esac
done

if [ "$config_changed" = true ]; then
  echo "KGEN: Configuration changed, checking lock file..."
  
  if command -v kgen >/dev/null 2>&1; then
    if ! kgen drift check --quiet; then
      echo "KGEN: Lock file drift detected, consider updating with 'kgen lock generate'"
    fi
  else
    echo "KGEN: CLI not found, please check lock file manually"
  fi
fi

exit 0
`;
  }

  /**
   * Get Git blame information for lock file
   * @returns {Promise<Object>} Blame information
   */
  async getLockFileBlame() {
    if (!await this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a Git repository'
      };
    }

    const lockPath = join(this.projectRoot, this.lockFileName);
    if (!existsSync(lockPath)) {
      return {
        success: false,
        error: 'Lock file does not exist'
      };
    }

    try {
      const relativePath = relative(this.projectRoot, lockPath);
      const result = await execAsync(
        `git blame --line-porcelain "${relativePath}"`,
        { cwd: this.projectRoot }
      );

      const lines = result.stdout.trim().split('\n');
      const blame = [];
      
      let currentCommit = null;
      let lineNumber = 0;
      
      for (const line of lines) {
        if (line.match(/^[0-9a-f]{40}/)) {
          currentCommit = {
            hash: line.split(' ')[0],
            lineNumber: ++lineNumber
          };
        } else if (line.startsWith('author ')) {
          if (currentCommit) {
            currentCommit.author = line.substring(7);
          }
        } else if (line.startsWith('author-time ')) {
          if (currentCommit) {
            const timestamp = parseInt(line.substring(12));
            currentCommit.timestamp = new Date(timestamp * 1000).toISOString();
          }
        } else if (line.startsWith('\t')) {
          if (currentCommit) {
            currentCommit.content = line.substring(1);
            blame.push(currentCommit);
            currentCommit = null;
          }
        }
      }

      return {
        success: true,
        blame,
        file: relativePath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate Git ignore patterns for KGEN
   * @returns {Array} Gitignore patterns
   */
  generateGitIgnorePatterns() {
    return [
      '# KGEN generated files',
      '.kgen/cache/',
      '.kgen/temp/',
      '.kgen/logs/',
      '*.kgen.backup.*',
      '',
      '# KGEN lock file backups', 
      'kgen.lock.json.backup.*',
      '',
      '# Keep lock file and config',
      '!kgen.lock.json',
      '!kgen.config.*',
      '!.kgenrc.*'
    ];
  }

  /**
   * Update .gitignore with KGEN patterns
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateGitIgnore(options = {}) {
    const gitignorePath = join(this.projectRoot, '.gitignore');
    const patterns = this.generateGitIgnorePatterns();
    const marker = '# KGEN';
    
    try {
      let content = '';
      let hasKgenSection = false;
      
      if (existsSync(gitignorePath)) {
        content = readFileSync(gitignorePath, 'utf8');
        hasKgenSection = content.includes(marker);
      }
      
      if (!hasKgenSection || options.force) {
        const newContent = hasKgenSection ? 
          this.replaceKgenSection(content, patterns) :
          content + (content.endsWith('\n') ? '' : '\n') + '\n' + patterns.join('\n') + '\n';
        
        writeFileSync(gitignorePath, newContent);
        
        return {
          success: true,
          action: hasKgenSection ? 'updated' : 'added',
          patterns: patterns.length
        };
      } else {
        return {
          success: true,
          action: 'already-exists',
          message: 'KGEN patterns already exist in .gitignore'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Replace KGEN section in gitignore content
   * @param {string} content - Current gitignore content
   * @param {Array} patterns - New patterns to insert
   * @returns {string} Updated content
   */
  replaceKgenSection(content, patterns) {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => line.includes('# KGEN'));
    
    if (startIndex === -1) {
      return content + '\n' + patterns.join('\n') + '\n';
    }
    
    // Find end of KGEN section (next section or end of file)
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('#') && !lines[i].includes('KGEN')) {
        endIndex = i;
        break;
      }
    }
    
    // Replace the section
    const before = lines.slice(0, startIndex);
    const after = lines.slice(endIndex);
    
    return [...before, ...patterns, ...after].join('\n');
  }
}

/**
 * Default Git integration instance
 */
export const gitIntegration = new GitIntegration();

/**
 * Convenience function to get Git status
 * @param {Object} options - Options
 * @returns {Promise<Object>} Git status
 */
export async function getGitStatus(options = {}) {
  const git = new GitIntegration(options);
  return git.getStatus();
}

/**
 * Convenience function to track config files
 * @param {Object} options - Options
 * @returns {Promise<Object>} Tracking result
 */
export async function trackConfigFiles(options = {}) {
  const git = new GitIntegration(options);
  return git.trackConfigFiles(options.files);
}
