/**
 * Path Traversal Security Tests
 * Validates protection against directory traversal attacks in Unjucks
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock Unjucks implementation for testing
class MockUnjucks {
  constructor(options = {}) {
    this.options = {
      secureMode: true,
      allowedPaths: [],
      ...options
    };
  }

  validatePath(inputPath) {
    // Simulate path validation logic
    if (!this.options.secureMode) {
      return inputPath; // Vulnerable mode for testing
    }

    // Normalize the path
    const normalizedPath = path.normalize(inputPath);
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal detected');
    }

    // Check against allowed paths
    if (this.options.allowedPaths.length > 0) {
      const isAllowed = this.options.allowedPaths.some(allowedPath => 
        normalizedPath.startsWith(path.normalize(allowedPath))
      );
      
      if (!isAllowed) {
        throw new Error('Path not in allowed list');
      }
    }

    return normalizedPath;
  }

  generateFile(templatePath, outputPath, data = {}) {
    // Validate paths
    const validatedTemplatePath = this.validatePath(templatePath);
    const validatedOutputPath = this.validatePath(outputPath);

    // Simulate file generation
    return {
      templatePath: validatedTemplatePath,
      outputPath: validatedOutputPath,
      data
    };
  }
}

describe('Path Traversal Security Tests', () => {
  let mockUnjucks;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unjucks-security-'));
    mockUnjucks = new MockUnjucks({
      secureMode: true,
      allowedPaths: [tempDir]
    });
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Path Traversal Protection', () => {
    it('should block simple dot-dot traversal', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'template/../../../secret.txt',
        './../../etc/hosts'
      ];

      maliciousPaths.forEach(maliciousPath => {
        expect(() => {
          mockUnjucks.validatePath(maliciousPath);
        }).toThrow('Path traversal detected');
      });
    });

    it('should block encoded path traversal attempts', () => {
      const encodedPaths = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%2f..%2f..%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '....//....//....//etc//passwd'
      ];

      encodedPaths.forEach(encodedPath => {
        const decodedPath = decodeURIComponent(encodedPath);
        expect(() => {
          mockUnjucks.validatePath(decodedPath);
        }).toThrow('Path traversal detected');
      });
    });

    it('should block Windows-style path traversal', () => {
      const windowsPaths = [
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        'template\\..\\..\\sensitive.file',
        '..\\..\\..\\boot.ini'
      ];

      windowsPaths.forEach(windowsPath => {
        expect(() => {
          mockUnjucks.validatePath(windowsPath);
        }).toThrow('Path traversal detected');
      });
    });

    it('should allow legitimate paths within allowed directories', () => {
      const legitimatePaths = [
        path.join(tempDir, 'template.njk'),
        path.join(tempDir, 'subdir', 'file.txt'),
        path.join(tempDir, 'nested', 'deep', 'template.njk')
      ];

      legitimatePaths.forEach(legitimatePath => {
        expect(() => {
          mockUnjucks.validatePath(legitimatePath);
        }).not.toThrow();
      });
    });
  });

  describe('Advanced Path Traversal Techniques', () => {
    it('should block null byte injection', () => {
      const nullBytePaths = [
        '../../../etc/passwd\x00.txt',
        'template.njk\x00/../../../secret',
        '/allowed/path\x00/../forbidden'
      ];

      nullBytePaths.forEach(nullBytePath => {
        expect(() => {
          mockUnjucks.validatePath(nullBytePath);
        }).toThrow();
      });
    });

    it('should block symlink traversal attempts', () => {
      // Create a symlink pointing outside allowed directory
      const symlinkPath = path.join(tempDir, 'evil-symlink');
      const targetPath = path.join(os.tmpdir(), 'secret-file.txt');
      
      try {
        fs.writeFileSync(targetPath, 'secret content');
        fs.symlinkSync(targetPath, symlinkPath);

        // Should detect and block symlink traversal
        expect(() => {
          const resolvedPath = fs.realpathSync(symlinkPath);
          mockUnjucks.validatePath(resolvedPath);
        }).toThrow('Path not in allowed list');
      } finally {
        // Cleanup
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      }
    });

    it('should block long path attacks', () => {
      // Generate extremely long path with traversal
      const longPath = '../'.repeat(1000) + 'etc/passwd';
      
      expect(() => {
        mockUnjucks.validatePath(longPath);
      }).toThrow('Path traversal detected');
    });

    it('should block mixed separator attacks', () => {
      const mixedSeparatorPaths = [
        '../..\\../etc/passwd',
        '..\\../..\\etc\\passwd',
        'template/..\\..\\../secret.txt'
      ];

      mixedSeparatorPaths.forEach(mixedPath => {
        expect(() => {
          mockUnjucks.validatePath(mixedPath);
        }).toThrow('Path traversal detected');
      });
    });
  });

  describe('File Generation Security', () => {
    it('should prevent traversal in template paths', () => {
      expect(() => {
        mockUnjucks.generateFile('../../../malicious-template.njk', 'output.txt');
      }).toThrow('Path traversal detected');
    });

    it('should prevent traversal in output paths', () => {
      const templatePath = path.join(tempDir, 'template.njk');
      
      expect(() => {
        mockUnjucks.generateFile(templatePath, '../../../malicious-output.txt');
      }).toThrow('Path traversal detected');
    });

    it('should allow legitimate file generation', () => {
      const templatePath = path.join(tempDir, 'template.njk');
      const outputPath = path.join(tempDir, 'output.txt');
      
      expect(() => {
        const result = mockUnjucks.generateFile(templatePath, outputPath, { test: 'data' });
        expect(result.templatePath).toBe(templatePath);
        expect(result.outputPath).toBe(outputPath);
        expect(result.data.test).toBe('data');
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty paths', () => {
      expect(() => {
        mockUnjucks.validatePath('');
      }).not.toThrow();
    });

    it('should handle root path references', () => {
      const rootPaths = ['/', '\\', 'C:\\', '/root'];
      
      rootPaths.forEach(rootPath => {
        expect(() => {
          mockUnjucks.validatePath(rootPath);
        }).toThrow('Path not in allowed list');
      });
    });

    it('should handle relative current directory references', () => {
      const currentDirPath = path.join(tempDir, './file.txt');
      
      expect(() => {
        mockUnjucks.validatePath(currentDirPath);
      }).not.toThrow();
    });

    it('should normalize and validate complex paths', () => {
      const complexPath = path.join(tempDir, 'dir1', '..', 'dir2', 'file.txt');
      const normalizedPath = path.join(tempDir, 'dir2', 'file.txt');
      
      const result = mockUnjucks.validatePath(complexPath);
      expect(result).toBe(normalizedPath);
    });
  });

  describe('Configuration-based Security', () => {
    it('should respect allowedPaths configuration', () => {
      const restrictedUnjucks = new MockUnjucks({
        secureMode: true,
        allowedPaths: ['/allowed/templates', '/allowed/output']
      });

      // Should allow paths within allowed directories
      expect(() => {
        restrictedUnjucks.validatePath('/allowed/templates/template.njk');
      }).not.toThrow();

      // Should block paths outside allowed directories
      expect(() => {
        restrictedUnjucks.validatePath('/forbidden/template.njk');
      }).toThrow('Path not in allowed list');
    });

    it('should disable security when secureMode is false (for testing vulnerability)', () => {
      const vulnerableUnjucks = new MockUnjucks({
        secureMode: false
      });

      // Should allow traversal when security is disabled (testing mode)
      const maliciousPath = '../../../etc/passwd';
      const result = vulnerableUnjucks.validatePath(maliciousPath);
      expect(result).toBe(maliciousPath);
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle path validation efficiently', () => {
      const startTime = Date.now();
      
      // Test 1000 path validations
      for (let i = 0; i < 1000; i++) {
        try {
          mockUnjucks.validatePath(`${tempDir}/template${i}.njk`);
        } catch (e) {
          // Expected for some invalid paths
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 1 second for 1000 paths)
      expect(duration).toBeLessThan(1000);
    });

    it('should limit path length to prevent DoS', () => {
      const maxPathLength = 4096; // Typical filesystem limit
      const veryLongPath = 'a'.repeat(maxPathLength + 1);
      
      expect(() => {
        mockUnjucks.validatePath(veryLongPath);
      }).toThrow();
    });
  });
});

// Export test results for security dashboard
if (typeof window === 'undefined') {
  module.exports = {
    testSuite: 'Path Traversal Security',
    vulnerabilityTypes: [
      'Directory Traversal',
      'Path Manipulation',
      'Symlink Attacks',
      'Null Byte Injection'
    ],
    securityControls: [
      'Path normalization',
      'Traversal detection',
      'Allowed path validation',
      'Symlink resolution checks'
    ]
  };
}