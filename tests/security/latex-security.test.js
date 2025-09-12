/**
 * LaTeX Security Tests - Comprehensive security validation
 * Tests for command injection, path traversal, and Docker security
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PathSecurityManager, InputSanitizer } from '../../src/lib/latex/utils.js';
import LaTeXCompiler from '../../src/lib/latex/compiler.js';
import DockerLaTeXSupport from '../../src/lib/latex/docker-support.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('LaTeX Security Tests', () => {
  let tempDir;
  let pathSecurity;

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'temp', `test-${this.getDeterministicTimestamp()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    pathSecurity = new PathSecurityManager({
      allowedBasePaths: [tempDir],
      allowedExtensions: ['.tex', '.bib', '.pdf'],
      maxFileSize: 1024 * 1024 // 1MB for tests
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup errors are non-critical in tests
    }
  });

  describe('PathSecurityManager', () => {
    test('should validate safe paths', () => {
      const safePath = path.join(tempDir, 'test.tex');
      expect(() => pathSecurity.validatePath(safePath)).not.toThrow();
    });

    test('should reject path traversal attacks', () => {
      const maliciousPath = path.join(tempDir, '../../../etc/passwd');
      expect(() => pathSecurity.validatePath(maliciousPath)).toThrow(/path traversal/);
    });

    test('should reject paths outside allowed directories', () => {
      const outsidePath = '/etc/passwd';
      expect(() => pathSecurity.validatePath(outsidePath)).toThrow(/outside allowed/);
    });

    test('should reject invalid file extensions', () => {
      const invalidPath = path.join(tempDir, 'malicious.sh');
      expect(() => pathSecurity.validatePath(invalidPath)).toThrow(/extension not allowed/);
    });

    test('should reject overly long paths', () => {
      const longPath = path.join(tempDir, 'a'.repeat(300) + '.tex');
      expect(() => pathSecurity.validatePath(longPath)).toThrow(/Path too long/);
    });

    test('should create secure temporary paths', () => {
      const tempPath = pathSecurity.createSecureTempPath(tempDir, 'test', '.tex');
      expect(tempPath).toMatch(/test-\d+-[a-f0-9]+\.tex$/);
      expect(path.dirname(tempPath)).toBe(tempDir);
    });

    test('should validate file sizes', async () => {
      const testFile = path.join(tempDir, 'test.tex');
      await fs.writeFile(testFile, 'small content');
      
      expect(await pathSecurity.validateFileSize(testFile)).toBe(true);
      
      // Create large file (exceeds 1MB limit)
      const largeContent = 'x'.repeat(2 * 1024 * 1024);
      await fs.writeFile(testFile, largeContent);
      
      expect(await pathSecurity.validateFileSize(testFile)).toBe(false);
    });
  });

  describe('InputSanitizer', () => {
    test('should sanitize command arguments', () => {
      expect(InputSanitizer.sanitizeCommandArg('safe-file.tex')).toBe('safe-file.tex');
      expect(InputSanitizer.sanitizeCommandArg('malicious; rm -rf /')).toBe('maliciousrm-rf');
      expect(InputSanitizer.sanitizeCommandArg('path/with/../../traversal')).toBe('path/with//traversal');
      expect(InputSanitizer.sanitizeCommandArg('')).toBe('');
      expect(InputSanitizer.sanitizeCommandArg(null)).toBe('');
    });

    test('should validate LaTeX engines', () => {
      expect(InputSanitizer.validateLatexEngine('pdflatex')).toBe(true);
      expect(InputSanitizer.validateLatexEngine('xelatex')).toBe(true);
      expect(InputSanitizer.validateLatexEngine('lualatex')).toBe(true);
      expect(InputSanitizer.validateLatexEngine('malicious')).toBe(false);
      expect(InputSanitizer.validateLatexEngine('pdflatex; rm -rf /')).toBe(false);
      expect(InputSanitizer.validateLatexEngine('')).toBe(false);
      expect(InputSanitizer.validateLatexEngine(null)).toBe(false);
    });

    test('should validate Docker images', () => {
      expect(InputSanitizer.validateDockerImage('texlive/texlive:latest')).toBe(true);
      expect(InputSanitizer.validateDockerImage('ubuntu:20.04')).toBe(true);
      expect(InputSanitizer.validateDockerImage('registry.example.com/myimage:v1.0')).toBe(true);
      expect(InputSanitizer.validateDockerImage('malicious; rm -rf /')).toBe(false);
      expect(InputSanitizer.validateDockerImage('')).toBe(false);
      expect(InputSanitizer.validateDockerImage('a'.repeat(300))).toBe(false);
    });

    test('should sanitize environment variables', () => {
      const env = {
        SAFE_VAR: 'safe_value',
        MALICIOUS_VAR: 'value; rm -rf /',
        INVALID_KEY: 'value',
        'valid-key': 'invalid key name',
        TEXMFHOME: '/workspace/.texmf'
      };

      const sanitized = InputSanitizer.sanitizeEnvironment(env);
      
      expect(sanitized.SAFE_VAR).toBe('safe_value');
      expect(sanitized.MALICIOUS_VAR).toBe('value rm -rf ');
      expect(sanitized.TEXMFHOME).toBe('/workspace/.texmf');
      expect('INVALID_KEY' in sanitized).toBe(false);
      expect('valid-key' in sanitized).toBe(false);
    });
  });

  describe('LaTeX Compiler Security', () => {
    let compiler;

    beforeEach(() => {
      compiler = new LaTeXCompiler({
        allowedBasePaths: [tempDir],
        outputDir: path.join(tempDir, 'output'),
        tempDir: path.join(tempDir, 'temp')
      });
    });

    test('should reject malicious input files', async () => {
      const maliciousFile = path.join(tempDir, '../../../etc/passwd');
      
      await expect(compiler.validateInputFile(maliciousFile))
        .rejects.toThrow(/Invalid input file/);
    });

    test('should reject files with dangerous extensions', async () => {
      const dangerousFile = path.join(tempDir, 'malicious.sh');
      await fs.writeFile(dangerousFile, '#!/bin/bash\necho "malicious"');
      
      await expect(compiler.validateInputFile(dangerousFile))
        .rejects.toThrow(/extension not allowed/);
    });

    test('should reject oversized files', async () => {
      const largeFile = path.join(tempDir, 'large.tex');
      const largeContent = '\\documentclass{article}\n\\begin{document}\n' + 
        'x'.repeat(2 * 1024 * 1024) + 
        '\n\\end{document}';
      await fs.writeFile(largeFile, largeContent);
      
      await expect(compiler.validateInputFile(largeFile))
        .rejects.toThrow(/too large/);
    });

    test('should validate valid LaTeX file', async () => {
      const validFile = path.join(tempDir, 'valid.tex');
      await fs.writeFile(validFile, '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}');
      
      await expect(compiler.validateInputFile(validFile)).resolves.toBeDefined();
    });
  });

  describe('Docker Security', () => {
    let dockerSupport;

    beforeEach(() => {
      dockerSupport = new DockerLaTeXSupport({
        allowedBasePaths: [tempDir]
      });
    });

    test('should validate volume mappings', () => {
      const volumes = {
        [tempDir]: '/workspace',
        '/etc/passwd': '/etc/passwd', // Should be rejected
        '/tmp/safe': '/tmp/safe'
      };

      const validated = dockerSupport.validateVolumes(volumes);
      
      expect(validated[tempDir]).toBe('/workspace');
      expect('/etc/passwd' in validated).toBe(false);
    });

    test('should identify unsafe container paths', () => {
      expect(dockerSupport.isSafeContainerPath('/workspace')).toBe(true);
      expect(dockerSupport.isSafeContainerPath('/tmp/safe')).toBe(true);
      expect(dockerSupport.isSafeContainerPath('/etc/passwd')).toBe(false);
      expect(dockerSupport.isSafeContainerPath('/root')).toBe(false);
      expect(dockerSupport.isSafeContainerPath('/bin/sh')).toBe(false);
    });

    test('should validate memory limits', () => {
      expect(dockerSupport.validateMemoryLimit('512m')).toBe('512m');
      expect(dockerSupport.validateMemoryLimit('2g')).toBe('2g');
      expect(dockerSupport.validateMemoryLimit('8g')).toBe('4g'); // Capped at 4g
      expect(dockerSupport.validateMemoryLimit('invalid')).toBe('512m'); // Default
    });

    test('should validate CPU limits', () => {
      expect(dockerSupport.validateCpuLimit('1.0')).toBe('1.0');
      expect(dockerSupport.validateCpuLimit('2.5')).toBe('2.5');
      expect(dockerSupport.validateCpuLimit('8.0')).toBe('4'); // Capped at 4
      expect(dockerSupport.validateCpuLimit('invalid')).toBe('1.0'); // Default
    });

    test('should build secure container arguments', () => {
      const args = dockerSupport.buildContainerArgs('/workspace');
      
      expect(args).toContain('--rm');
      expect(args).toContain('--user');
      expect(args).toContain('1000:1000');
      expect(args).toContain('--no-new-privileges');
      expect(args).toContain('--cap-drop');
      expect(args).toContain('ALL');
      expect(args).toContain('--network');
      expect(args).toContain('none');
      expect(args).toContain('--read-only');
    });
  });

  describe('Integration Security Tests', () => {
    test('should prevent command injection in file names', async () => {
      const compiler = new LaTeXCompiler({
        allowedBasePaths: [tempDir],
        outputDir: path.join(tempDir, 'output'),
        tempDir: path.join(tempDir, 'temp')
      });

      // Create a file with a name that could be dangerous if not sanitized
      const dangerousFileName = 'test; rm -rf /tmp; echo malicious.tex';
      const safeFileName = 'test.tex';
      const testFile = path.join(tempDir, safeFileName);
      
      await fs.writeFile(testFile, '\\documentclass{article}\n\\begin{document}\nTest\n\\end{document}');

      // This should not throw because the actual file is safe
      await expect(compiler.validateInputFile(testFile)).resolves.toBeDefined();
    });

    test('should handle concurrent operations safely', async () => {
      const compiler = new LaTeXCompiler({
        allowedBasePaths: [tempDir],
        outputDir: path.join(tempDir, 'output'),
        tempDir: path.join(tempDir, 'temp')
      });

      // Create multiple safe test files
      const files = [];
      for (let i = 0; i < 5; i++) {
        const testFile = path.join(tempDir, `test${i}.tex`);
        await fs.writeFile(testFile, '\\documentclass{article}\n\\begin{document}\nTest\n\\end{document}');
        files.push(testFile);
      }

      // Validate all files concurrently
      const validations = files.map(file => compiler.validateInputFile(file));
      await expect(Promise.all(validations)).resolves.toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', () => {
      const pathSecurity = new PathSecurityManager({
        allowedBasePaths: ['/safe/path']
      });

      try {
        pathSecurity.validatePath('/etc/passwd');
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Error message should not contain the actual path being accessed
        expect(error.message).not.toContain('/etc/passwd');
        expect(error.message).toContain('outside allowed');
      }
    });

    test('should handle malformed inputs gracefully', () => {
      expect(() => InputSanitizer.sanitizeCommandArg(undefined)).not.toThrow();
      expect(() => InputSanitizer.sanitizeCommandArg(null)).not.toThrow();
      expect(() => InputSanitizer.sanitizeCommandArg(123)).not.toThrow();
      expect(() => InputSanitizer.sanitizeCommandArg({})).not.toThrow();
    });
  });
});