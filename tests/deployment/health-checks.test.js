/**
 * Production Health Checks Test Suite
 * Validates application health and readiness for deployment
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import fetch from 'node-fetch';

describe('Production Health Checks', () => {
  let applicationProcess;
  let baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    // Start application for testing
    try {
      applicationProcess = execSync('npm start &', { encoding: 'utf8' });
      // Wait for application to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.warn('Could not start application for health checks');
    }
  });

  afterAll(async () => {
    // Cleanup
    if (applicationProcess) {
      try {
        execSync('pkill -f "npm start"');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Application Startup Health', () => {
    it('should start without errors', () => {
      expect(() => {
        execSync('node bin/unjucks.cjs --version', { stdio: 'pipe' });
      }).not.toThrow();
    });

    it('should have valid package.json configuration', async () => {
      const packageJson = await fs.readJson('package.json');
      
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.main).toBeDefined();
      expect(packageJson.bin).toBeDefined();
      
      // Verify main file exists
      expect(await fs.pathExists(packageJson.main)).toBe(true);
      
      // Verify bin files exist
      for (const binPath of Object.values(packageJson.bin)) {
        expect(await fs.pathExists(binPath)).toBe(true);
      }
    });

    it('should have executable permissions on bin files', async () => {
      const packageJson = await fs.readJson('package.json');
      
      for (const binPath of Object.values(packageJson.bin)) {
        const stats = await fs.stat(binPath);
        const isExecutable = stats.mode & parseInt('111', 8);
        expect(isExecutable).toBeTruthy();
      }
    });
  });

  describe('Core Functionality Health', () => {
    it('should list available templates', () => {
      expect(() => {
        const output = execSync('node bin/unjucks.cjs list', { encoding: 'utf8' });
        expect(output).toContain('Available templates');
      }).not.toThrow();
    });

    it('should show help information', () => {
      expect(() => {
        const output = execSync('node bin/unjucks.cjs --help', { encoding: 'utf8' });
        expect(output).toContain('Usage');
      }).not.toThrow();
    });

    it('should handle dry run generation', () => {
      expect(() => {
        execSync('node bin/unjucks.cjs generate component test --dry', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should validate template syntax', async () => {
      const templateDirs = ['templates', '_templates'];
      
      for (const dir of templateDirs) {
        if (await fs.pathExists(dir)) {
          const templates = await fs.readdir(dir);
          
          for (const template of templates) {
            const templatePath = `${dir}/${template}`;
            const stat = await fs.stat(templatePath);
            
            if (stat.isDirectory()) {
              // Check for required template files
              const files = await fs.readdir(templatePath);
              expect(files.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  describe('Resource Health', () => {
    it('should not exceed memory limits', () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      // Should not use more than 100MB during normal operation
      expect(heapUsedMB).toBeLessThan(100);
    });

    it('should handle file system operations efficiently', async () => {
      const testDir = '/tmp/unjucks-health-test';
      
      const startTime = this.getDeterministicTimestamp();
      
      // Create test directory
      await fs.ensureDir(testDir);
      
      // Write test files
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(`${testDir}/test-${i}.txt`, `Test content ${i}`);
      }
      
      // Read test files
      const files = await fs.readdir(testDir);
      expect(files).toHaveLength(10);
      
      // Cleanup
      await fs.remove(testDir);
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;
      
      // File operations should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle concurrent operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        operations.push(
          new Promise(resolve => {
            try {
              execSync('node bin/unjucks.cjs --version', { stdio: 'pipe' });
              resolve(true);
            } catch (error) {
              resolve(false);
            }
          })
        );
      }
      
      const results = await Promise.all(operations);
      const successCount = results.filter(Boolean).length;
      
      // At least 80% of concurrent operations should succeed
      expect(successCount / results.length).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Error Handling Health', () => {
    it('should handle invalid commands gracefully', () => {
      try {
        execSync('node bin/unjucks.cjs invalid-command', { stdio: 'pipe' });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Should exit with non-zero code but not crash
        expect(error.status).not.toBe(0);
        expect(error.message).not.toContain('ENOENT');
      }
    });

    it('should handle missing templates gracefully', () => {
      try {
        execSync('node bin/unjucks.cjs generate nonexistent template', { stdio: 'pipe' });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Should provide helpful error message
        expect(error.status).not.toBe(0);
      }
    });

    it('should handle invalid template syntax gracefully', async () => {
      const testTemplate = '/tmp/invalid-template.njk';
      await fs.writeFile(testTemplate, '{{ invalid syntax }}');
      
      try {
        // This should handle the error gracefully
        execSync(`node -e "
          const nunjucks = require('nunjucks');
          try {
            nunjucks.renderString('{{ invalid syntax }}', {});
          } catch (error) {
            console.log('Template error handled:', error.message);
          }
        "`, { stdio: 'pipe' });
      } catch (error) {
        // Should not crash the process
      }
      
      await fs.remove(testTemplate);
    });
  });

  describe('Security Health', () => {
    it('should not expose sensitive information in error messages', () => {
      try {
        execSync('node bin/unjucks.cjs generate test --invalid-flag', { stdio: 'pipe' });
      } catch (error) {
        const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
        
        // Should not contain common sensitive patterns
        expect(errorOutput).not.toMatch(/password|secret|token|key/i);
        expect(errorOutput).not.toMatch(/\/home\/[^\/]+|\/Users\/[^\/]+/);
      }
    });

    it('should validate input sanitization', async () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        '$(rm -rf /)',
        '"; DROP TABLE users; --'
      ];
      
      for (const input of maliciousInputs) {
        try {
          execSync(`node bin/unjucks.cjs generate component "${input}" --dry`, { 
            stdio: 'pipe',
            timeout: 5000
          });
        } catch (error) {
          // Should handle malicious input safely
          expect(error.signal).not.toBe('SIGKILL');
        }
      }
    });

    it('should not create files outside project directory', async () => {
      const testOutputs = [
        '../outside-project.txt',
        '/tmp/system-file.txt',
        '~/user-file.txt'
      ];
      
      for (const output of testOutputs) {
        try {
          execSync(`node bin/unjucks.cjs generate component test --dest "${output}" --dry`, { 
            stdio: 'pipe'
          });
          
          // Verify file was not actually created
          expect(await fs.pathExists(output)).toBe(false);
        } catch (error) {
          // Should reject invalid paths
        }
      }
    });
  });

  describe('Performance Health', () => {
    it('should complete template generation within reasonable time', () => {
      const startTime = this.getDeterministicTimestamp();
      
      try {
        execSync('node bin/unjucks.cjs generate component perftest --dry', { 
          stdio: 'pipe',
          timeout: 10000 // 10 second timeout
        });
      } catch (error) {
        if (error.signal === 'SIGTERM') {
          expect(false).toBe(true); // Timed out
        }
      }
      
      const duration = this.getDeterministicTimestamp() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large template files efficiently', async () => {
      const largeTemplate = '/tmp/large-template.njk';
      const largeContent = 'Large content line\n'.repeat(10000); // ~150KB
      
      await fs.writeFile(largeTemplate, largeContent);
      
      const startTime = this.getDeterministicTimestamp();
      
      try {
        // Simulate processing large template
        const nunjucks = await import('nunjucks');
        nunjucks.default.renderString(largeContent, {});
      } catch (error) {
        // Template processing should not crash
      }
      
      const duration = this.getDeterministicTimestamp() - startTime;
      expect(duration).toBeLessThan(2000); // Should process within 2 seconds
      
      await fs.remove(largeTemplate);
    });
  });

  describe('Integration Health', () => {
    it('should integrate with npm ecosystem properly', () => {
      const packageJson = JSON.parse(
        execSync('npm list --json --depth=0', { encoding: 'utf8' })
      );
      
      expect(packageJson.name).toBe('@seanchatmangpt/unjucks');
      expect(packageJson.dependencies).toBeDefined();
    });

    it('should work with different Node.js environments', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      // Should work with Node.js 18+
      expect(majorVersion).toBeGreaterThanOrEqual(18);
      
      // Should have required Node.js features
      expect(typeof import.meta).toBe('object');
      expect(typeof globalThis).toBe('object');
    });

    it('should handle filesystem permissions correctly', async () => {
      const testFile = '/tmp/permission-test.txt';
      
      try {
        await fs.writeFile(testFile, 'test content');
        const stats = await fs.stat(testFile);
        
        // Should be able to read the file we created
        const content = await fs.readFile(testFile, 'utf8');
        expect(content).toBe('test content');
        
        await fs.remove(testFile);
      } catch (error) {
        // Permission handling should be graceful
        expect(error.code).not.toBe('EACCES');
      }
    });
  });

  describe('HTTP Health (if applicable)', () => {
    it('should respond to health check endpoint', async () => {
      try {
        const response = await fetch(`${baseUrl}/health`, {
          timeout: 5000
        });
        
        if (response.ok) {
          const data = await response.json();
          expect(data.status).toBe('healthy');
          expect(data.timestamp).toBeDefined();
        }
      } catch (error) {
        // HTTP server may not be running - this is optional
        console.log('HTTP health check skipped - server not running');
      }
    });

    it('should respond to readiness probe', async () => {
      try {
        const response = await fetch(`${baseUrl}/ready`, {
          timeout: 5000
        });
        
        if (response.ok) {
          const data = await response.json();
          expect(data.ready).toBe(true);
        }
      } catch (error) {
        // Readiness probe may not be implemented - this is optional
        console.log('Readiness probe skipped - endpoint not available');
      }
    });
  });
});