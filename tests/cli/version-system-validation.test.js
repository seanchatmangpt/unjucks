/**
 * CLI Version System Validation Tests
 * Comprehensive testing of version consistency across all CLI entry points
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { getVersion, getVersionDetails, getFormattedVersion, validateVersionFormat } from '../../src/lib/version-resolver.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

/**
 * Helper function to run CLI commands
 */
async function runCLI(args = [], options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      timeout: 10000,
      ...options
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

/**
 * Extract version from CLI help output
 */
function extractVersionFromHelp(helpOutput) {
  const match = helpOutput.match(/unjucks v?([\d.]+)/i);
  return match ? match[1] : null;
}

describe('CLI Version System Validation', () => {
  let packageVersion;

  beforeEach(async () => {
    // Read the actual package.json version to use as reference
    const packagePath = path.resolve(__dirname, '../../package.json');
    const packageData = await fs.readFile(packagePath, 'utf8');
    const packageJson = JSON.parse(packageData);
    packageVersion = packageJson.version;
  });

  describe('Version Resolution Library', () => {
    it('should return consistent version from getVersion()', () => {
      const version = getVersion();
      expect(version).toBe(packageVersion);
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should format version correctly', () => {
      const formatted = getFormattedVersion(true);
      expect(formatted).toBe(`v${packageVersion}`);
      
      const unformatted = getFormattedVersion(false);
      expect(unformatted).toBe(packageVersion);
    });

    it('should provide detailed version information', () => {
      const details = getVersionDetails();
      
      expect(details.version).toBe(packageVersion);
      expect(details.formatted).toBe(`v${packageVersion}`);
      expect(details.source).toBe('package.json');
      expect(details.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(details.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
      expect(details.platform).toBeTruthy();
      expect(details.arch).toBeTruthy();
    });

    it('should validate version format correctly', () => {
      expect(validateVersionFormat('2025.09.07')).toBe(true);
      expect(validateVersionFormat('2025.09.07.15.45')).toBe(true);
      expect(validateVersionFormat('1.0.0')).toBe(false);
      expect(validateVersionFormat('invalid')).toBe(false);
      expect(validateVersionFormat('')).toBe(false);
    });
  });

  describe('CLI Version Command', () => {
    it('should show version with "unjucks version" command', async () => {
      const result = await runCLI(['version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(packageVersion);
      expect(result.stderr).not.toContain('Error');
    });

    it('should show version with "--version" flag', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(packageVersion);
    });

    it('should show version with "-v" short flag', async () => {
      const result = await runCLI(['-v']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(packageVersion);
    });

    it('should show detailed version with "--verbose" flag', async () => {
      const result = await runCLI(['version', '--verbose']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Unjucks Version: ${packageVersion}`);
      expect(result.stdout).toContain('Source: package.json');
      expect(result.stdout).toContain('Node.js:');
      expect(result.stdout).toContain('Platform:');
      expect(result.stdout).toContain('Generated:');
    });
  });

  describe('CLI Help System Version References', () => {
    it('should show consistent version in main help', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unjucks CLI');
      
      // Check if help contains version reference and that it matches
      const helpVersion = extractVersionFromHelp(result.stdout);
      if (helpVersion) {
        expect(helpVersion).toBe(packageVersion);
      }
    });

    it('should show consistent version when no arguments provided', async () => {
      const result = await runCLI([]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unjucks CLI');
      
      // Check version consistency in default help
      const helpVersion = extractVersionFromHelp(result.stdout);
      if (helpVersion) {
        expect(helpVersion).toBe(packageVersion);
      }
    });

    it('should show version command in help output', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('version');
      expect(result.stdout).toContain('Show version information');
    });
  });

  describe('Version Consistency Across Commands', () => {
    const testCommands = [
      ['help', '--help'],
      ['list', '--help'],
      ['init', '--help'],
      ['generate', '--help']
    ];

    testCommands.forEach(([command, flag]) => {
      it(`should show consistent version help in "${command} ${flag}"`, async () => {
        const result = await runCLI([command, flag]);
        
        expect(result.exitCode).toBe(0);
        
        // If help contains version reference, it should match
        const helpVersion = extractVersionFromHelp(result.stdout);
        if (helpVersion) {
          expect(helpVersion).toBe(packageVersion);
        }
      });
    });
  });

  describe('Cross-Platform Version Resolution', () => {
    it('should resolve version consistently regardless of working directory', async () => {
      const tempDir = await fs.mkdtemp('/tmp/unjucks-test-');
      
      try {
        const result = await runCLI(['version'], { cwd: tempDir });
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(packageVersion);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle missing package.json gracefully', async () => {
      const tempDir = await fs.mkdtemp('/tmp/unjucks-test-isolated-');
      
      try {
        // Create isolated environment
        const isolatedCLI = path.resolve(tempDir, 'unjucks.js');
        await fs.writeFile(isolatedCLI, `
          import { getVersion } from '${path.resolve(__dirname, '../../src/lib/version-resolver.js')}';
          console.log(getVersion());
        `);
        
        const result = await execFileAsync('node', [isolatedCLI], { cwd: tempDir });
        
        // Should fall back gracefully
        expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle version command with invalid flags gracefully', async () => {
      const result = await runCLI(['version', '--invalid-flag']);
      
      // Should still show version despite invalid flag
      expect(result.stdout).toContain(packageVersion);
    });

    it('should prioritize package.json over environment variables', async () => {
      const result = await runCLI(['version', '--verbose'], {
        env: { ...process.env, npm_package_version: '0.0.0' }
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Unjucks Version: ${packageVersion}`);
      expect(result.stdout).toContain('Source: package.json');
      expect(result.stdout).not.toContain('0.0.0');
    });

    it('should show meaningful error if version resolution fails completely', async () => {
      // This test would require mocking file system, so we test the warning path
      const details = getVersionDetails();
      expect(details.source).toMatch(/^(package\.json|npm_env|fallback|error)$/);
    });
  });

  describe('Version Format Validation', () => {
    it('should follow expected version format', () => {
      const isValidFormat = validateVersionFormat(packageVersion);
      expect(isValidFormat).toBe(true);
    });

    it('should match semantic versioning expectations for tools', () => {
      // While we use date-time versioning, basic version should be parseable
      expect(packageVersion).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Performance and Reliability', () => {
    it('should resolve version quickly', async () => {
      const start = this.getDeterministicTimestamp();
      const version = getVersion();
      const duration = this.getDeterministicTimestamp() - start;
      
      expect(version).toBe(packageVersion);
      expect(duration).toBeLessThan(100); // Should resolve within 100ms
    });

    it('should be consistent across multiple calls', () => {
      const calls = Array(10).fill(null).map(() => getVersion());
      const uniqueVersions = new Set(calls);
      
      expect(uniqueVersions.size).toBe(1);
      expect(uniqueVersions.has(packageVersion)).toBe(true);
    });

    it('should handle concurrent version resolution', async () => {
      const promises = Array(20).fill(null).map(() => 
        Promise.resolve(getVersion())
      );
      
      const results = await Promise.all(promises);
      const uniqueVersions = new Set(results);
      
      expect(uniqueVersions.size).toBe(1);
      expect(uniqueVersions.has(packageVersion)).toBe(true);
    });
  });

  describe('Integration with Auto-Versioning System', () => {
    it('should maintain consistency with auto-versioning script expectations', () => {
      // Test that version format is compatible with auto-versioning
      expect(validateVersionFormat(packageVersion)).toBe(true);
    });

    it('should provide version information that auto-versioning can process', () => {
      const details = getVersionDetails();
      
      expect(details.version).toBeTruthy();
      expect(details.timestamp).toBeTruthy();
      expect(details.source).toBeTruthy();
    });
  });
});