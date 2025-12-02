/**
 * Tests for Git Integration
 * 
 * Validates:
 * - Git repository detection and status
 * - Configuration file tracking
 * - Lock file history and blame
 * - Git hooks setup and management
 * - Gitignore pattern updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { GitIntegration, getGitStatus, trackConfigFiles } from '../../src/config/git-integration.js';

// Mock child_process with more comprehensive Git command simulation
const mockExec = vi.fn();
vi.mock('child_process', () => ({
  exec: mockExec
}));

describe('GitIntegration', () => {
  let testDir;
  let gitIntegration;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-git-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    gitIntegration = new GitIntegration({ projectRoot: testDir });
    
    // Reset mock
    mockExec.mockReset();
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Repository Detection', () => {
    it('should detect Git repository', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        }
      });
      
      const isRepo = await gitIntegration.isGitRepository();
      expect(isRepo).toBe(true);
    });

    it('should detect non-Git directory', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(new Error('not a git repository'), { stdout: '', stderr: 'fatal: not a git repository' });
        }
      });
      
      const isRepo = await gitIntegration.isGitRepository();
      expect(isRepo).toBe(false);
    });
  });

  describe('Git Status', () => {
    it('should get comprehensive Git status', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse HEAD')) {
          callback(null, { stdout: 'abc123def456789\n', stderr: '' });
        } else if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
          callback(null, { stdout: 'main\n', stderr: '' });
        } else if (cmd.includes('git status --porcelain')) {
          callback(null, { stdout: ' M kgen.config.js\n?? new-file.ttl\n', stderr: '' });
        } else if (cmd.includes('git tag --points-at HEAD')) {
          callback(null, { stdout: 'v1.0.0\nv1.0.1\n', stderr: '' });
        } else if (cmd.includes('git ls-files')) {
          callback(null, { stdout: 'kgen.config.js\nkgen.lock.json\nother.txt\n', stderr: '' });
        }
      });
      
      const status = await gitIntegration.getStatus();
      
      expect(status.isRepo).toBe(true);
      expect(status.commit).toBe('abc123def456789');
      expect(status.shortCommit).toBe('abc123de');
      expect(status.branch).toBe('main');
      expect(status.dirty).toBe(true);
      expect(status.tags).toEqual(['v1.0.0', 'v1.0.1']);
      expect(status.configFiles).toEqual(['kgen.config.js', 'kgen.lock.json']);
    });

    it('should handle non-Git repository status', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('not a git repository'));
      });
      
      const status = await gitIntegration.getStatus();
      
      expect(status.isRepo).toBe(false);
      expect(status.error).toBe('Not a Git repository');
    });

    it('should handle Git command errors', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse HEAD')) {
          callback(new Error('Command failed'));
        }
      });
      
      const status = await gitIntegration.getStatus();
      
      expect(status.isRepo).toBe(true);
      expect(status.error).toBe('Command failed');
    });
  });

  describe('Configuration File Tracking', () => {
    it('should track configuration files', async () => {
      let addCommands = [];
      
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git add')) {
          addCommands.push(cmd);
          callback(null, { stdout: '', stderr: '' });
        }
      });
      
      const result = await gitIntegration.trackConfigFiles();
      
      expect(result.success).toBe(true);
      expect(result.tracked.length).toBeGreaterThan(0);
      expect(addCommands.length).toBeGreaterThan(0);
    });

    it('should handle missing files gracefully', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git add')) {
          if (cmd.includes('nonexistent')) {
            callback(new Error('pathspec did not match any files'));
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        }
      });
      
      const result = await gitIntegration.trackConfigFiles(['nonexistent.config']);
      
      expect(result.success).toBe(true); // Should succeed despite missing files
    });

    it('should get tracked configuration files', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git ls-files')) {
          callback(null, {
            stdout: 'kgen.config.js\nkgen.lock.json\n.kgenrc.json\nother.txt\nREADME.md\n',
            stderr: ''
          });
        }
      });
      
      const files = await gitIntegration.getTrackedConfigFiles();
      
      expect(files).toEqual([
        'kgen.config.js',
        'kgen.lock.json',
        '.kgenrc.json'
      ]);
    });
  });

  describe('Configuration Changes', () => {
    it('should detect configuration changes', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git diff --cached')) {
          callback(null, { stdout: 'M\tkgen.config.js\n', stderr: '' });
        } else if (cmd.includes('git diff --name-status')) {
          callback(null, { stdout: 'A\tkgen.lock.json\n', stderr: '' });
        }
      });
      
      const changes = await gitIntegration.getConfigChanges();
      
      expect(changes.hasChanges).toBe(true);
      expect(changes.changes.modified).toContain('kgen.config.js');
      expect(changes.changes.added).toContain('kgen.lock.json');
    });

    it('should handle no changes', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git diff')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });
      
      const changes = await gitIntegration.getConfigChanges();
      
      expect(changes.hasChanges).toBe(false);
      expect(changes.changes.modified).toHaveLength(0);
      expect(changes.changes.added).toHaveLength(0);
      expect(changes.changes.deleted).toHaveLength(0);
    });
  });

  describe('Lock File History', () => {
    it('should get lock file commit history', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git log --oneline')) {
          callback(null, {
            stdout: 'abc123 Update lock file\ndef456 Initial lock file\n',
            stderr: ''
          });
        } else if (cmd.includes('git show --format')) {
          if (cmd.includes('abc123')) {
            callback(null, {
              stdout: '2022-01-02 10:00:00 +0000|John Doe|john@example.com\n\nkgen.lock.json\n',
              stderr: ''
            });
          } else if (cmd.includes('def456')) {
            callback(null, {
              stdout: '2022-01-01 09:00:00 +0000|Jane Smith|jane@example.com\n\nkgen.lock.json\n',
              stderr: ''
            });
          }
        }
      });
      
      const history = await gitIntegration.getLockFileHistory(5);
      
      expect(history).toHaveLength(2);
      expect(history[0].hash).toBe('abc123');
      expect(history[0].message).toBe('Update lock file');
      expect(history[0].author).toBe('John Doe');
      expect(history[1].hash).toBe('def456');
      expect(history[1].message).toBe('Initial lock file');
    });

    it('should handle missing lock file history', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git log')) {
          callback(new Error('No commits found'));
        }
      });
      
      const history = await gitIntegration.getLockFileHistory();
      
      expect(history).toHaveLength(0);
    });
  });

  describe('Commit Creation', () => {
    it('should commit configuration changes', async () => {
      let commitCalled = false;
      
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git add')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git diff --cached') || cmd.includes('git diff --name-status')) {
          callback(null, { stdout: 'M\tkgen.config.js\n', stderr: '' });
        } else if (cmd.includes('git commit')) {
          commitCalled = true;
          callback(null, { stdout: '[main abc123] Update configuration\n', stderr: '' });
        } else if (cmd.includes('git rev-parse HEAD')) {
          callback(null, { stdout: 'abc123def456\n', stderr: '' });
        }
      });
      
      const result = await gitIntegration.commitConfigChanges('Update KGEN config');
      
      expect(result.success).toBe(true);
      expect(result.commit).toBe('abc123def456');
      expect(result.message).toBe('Update KGEN config');
      expect(commitCalled).toBe(true);
    });

    it('should handle no changes to commit', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git add')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git diff')) {
          callback(null, { stdout: '', stderr: '' }); // No changes
        }
      });
      
      const result = await gitIntegration.commitConfigChanges();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('No configuration changes to commit');
    });
  });

  describe('Git Hooks', () => {
    it('should setup Git hooks', async () => {
      // Create .git/hooks directory
      const hooksDir = join(testDir, '.git', 'hooks');
      mkdirSync(hooksDir, { recursive: true });
      
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        }
      });
      
      const result = await gitIntegration.setupGitHooks();
      
      expect(result.success).toBe(true);
      expect(result.hooks).toContain('pre-commit');
      expect(result.hooks).toContain('post-merge');
      
      // Check hooks were created
      expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
      expect(existsSync(join(hooksDir, 'post-merge'))).toBe(true);
    });

    it('should generate pre-commit hook script', () => {
      const script = gitIntegration.generatePreCommitHook();
      
      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('KGEN: Validating configuration');
      expect(script).toContain('kgen drift check');
      expect(script).toContain('Invalid JSON syntax');
    });

    it('should generate post-merge hook script', () => {
      const script = gitIntegration.generatePostMergeHook();
      
      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('KGEN: Checking for configuration changes');
      expect(script).toContain('kgen.config.*|.kgenrc.*');
      expect(script).toContain('Lock file drift detected');
    });
  });

  describe('Lock File Blame', () => {
    it('should get blame information for lock file', async () => {
      // Create lock file
      writeFileSync(join(testDir, 'kgen.lock.json'), JSON.stringify({
        version: '2.0.0',
        project: { name: 'test' }
      }, null, 2));
      
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git blame --line-porcelain')) {
          callback(null, {
            stdout: `abc123def456 1 1 1
author John Doe
author-time 1640995200
\t{
author-time 1640995200
\t  "version": "2.0.0",
`,
            stderr: ''
          });
        }
      });
      
      const result = await gitIntegration.getLockFileBlame();
      
      expect(result.success).toBe(true);
      expect(result.blame.length).toBeGreaterThan(0);
      expect(result.blame[0].hash).toBe('abc123def456');
      expect(result.blame[0].author).toBe('John Doe');
    });

    it('should handle missing lock file', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        }
      });
      
      const result = await gitIntegration.getLockFileBlame();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Lock file does not exist');
    });
  });

  describe('Gitignore Management', () => {
    it('should generate gitignore patterns', () => {
      const patterns = gitIntegration.generateGitIgnorePatterns();
      
      expect(patterns).toContain('# KGEN generated files');
      expect(patterns).toContain('.kgen/cache/');
      expect(patterns).toContain('.kgen/temp/');
      expect(patterns).toContain('!kgen.lock.json');
      expect(patterns).toContain('!kgen.config.*');
    });

    it('should update gitignore with KGEN patterns', async () => {
      const result = await gitIntegration.updateGitIgnore();
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('added');
      
      const gitignoreContent = readFileSync(join(testDir, '.gitignore'), 'utf8');
      expect(gitignoreContent).toContain('# KGEN generated files');
      expect(gitignoreContent).toContain('.kgen/cache/');
    });

    it('should detect existing KGEN section', async () => {
      // Create gitignore with existing KGEN section
      writeFileSync(join(testDir, '.gitignore'), `
# Existing content
node_modules/

# KGEN generated files
.kgen/cache/
!kgen.lock.json

# Other content
*.log
`);
      
      const result = await gitIntegration.updateGitIgnore();
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('already-exists');
    });

    it('should replace existing KGEN section when forced', async () => {
      writeFileSync(join(testDir, '.gitignore'), `
# KGEN generated files
.kgen/old-cache/
`);
      
      const result = await gitIntegration.updateGitIgnore({ force: true });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      
      const content = readFileSync(join(testDir, '.gitignore'), 'utf8');
      expect(content).toContain('.kgen/cache/');
      expect(content).not.toContain('.kgen/old-cache/');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-Git repository errors gracefully', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('not a git repository'));
      });
      
      const result = await gitIntegration.trackConfigFiles();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a Git repository');
    });

    it('should handle Git command failures', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('git commit')) {
          callback(new Error('nothing to commit'));
        }
      });
      
      const result = await gitIntegration.commitConfigChanges('Test commit');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('nothing to commit');
    });
  });
});

describe('Convenience Functions', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-git-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mockExec.mockReset();
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should get Git status with convenience function', async () => {
    mockExec.mockImplementation((cmd, options, callback) => {
      if (cmd.includes('git rev-parse HEAD')) {
        callback(null, { stdout: 'abc123\n', stderr: '' });
      } else if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
        callback(null, { stdout: 'main\n', stderr: '' });
      } else if (cmd.includes('git status --porcelain')) {
        callback(null, { stdout: '', stderr: '' });
      } else if (cmd.includes('git tag --points-at HEAD')) {
        callback(null, { stdout: '', stderr: '' });
      } else if (cmd.includes('git ls-files')) {
        callback(null, { stdout: 'kgen.config.js\n', stderr: '' });
      }
    });
    
    const status = await getGitStatus({ projectRoot: testDir });
    
    expect(status.isRepo).toBe(true);
    expect(status.commit).toBe('abc123');
    expect(status.branch).toBe('main');
  });

  it('should track config files with convenience function', async () => {
    mockExec.mockImplementation((cmd, options, callback) => {
      if (cmd.includes('git rev-parse --git-dir')) {
        callback(null, { stdout: '.git\n', stderr: '' });
      } else if (cmd.includes('git add')) {
        callback(null, { stdout: '', stderr: '' });
      }
    });
    
    const result = await trackConfigFiles({
      projectRoot: testDir,
      files: ['custom.config.js']
    });
    
    expect(result.success).toBe(true);
  });
});
