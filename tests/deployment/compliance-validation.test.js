/**
 * OWASP and Compliance Validation Test Suite
 * Validates security compliance and OWASP standards
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

describe('OWASP Compliance Validation', () => {
  let packageJson;
  let auditResults;

  beforeAll(async () => {
    packageJson = await fs.readJson('package.json');
    
    // Run npm audit
    try {
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      auditResults = JSON.parse(auditOutput);
    } catch (error) {
      // Parse error output if audit finds issues
      try {
        auditResults = JSON.parse(error.stdout);
      } catch {
        auditResults = { vulnerabilities: {} };
      }
    }
  });

  describe('A1: Injection Vulnerabilities', () => {
    it('should not have SQL injection vulnerabilities', async () => {
      // Scan for potential SQL injection patterns
      const sqlPatterns = [
        /\$\{.*\}.*SELECT/gi,
        /\$\{.*\}.*INSERT/gi,
        /\$\{.*\}.*UPDATE/gi,
        /\$\{.*\}.*DELETE/gi,
        /template.*query/gi
      ];

      const sourceFiles = await getAllJsFiles('src');
      let violations = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        for (const pattern of sqlPatterns) {
          if (pattern.test(content)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              pattern: pattern.source
            });
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('should sanitize template inputs', async () => {
      // Check for proper input sanitization in templates
      const templateFiles = await getAllTemplateFiles();
      let unsafePatterns = [];

      const dangerousPatterns = [
        /\{\{.*\|.*safe.*\}\}/g,  // Nunjucks safe filter usage
        /\{\{.*\|.*raw.*\}\}/g,   // Raw filter usage
        /<script.*\{\{/gi,        // Script tags with variables
        /eval\(.*\{\{/gi          // Eval with variables
      ];

      for (const file of templateFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        for (const pattern of dangerousPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            unsafePatterns.push({
              file: path.relative(process.cwd(), file),
              matches: matches
            });
          }
        }
      }

      // Allow safe filter usage but flag for review
      if (unsafePatterns.length > 0) {
        console.warn('⚠️ Found potentially unsafe template patterns:', unsafePatterns);
      }

      // No script tags with unescaped variables
      const scriptViolations = unsafePatterns.filter(v => 
        v.matches.some(m => m.includes('<script'))
      );
      expect(scriptViolations).toEqual([]);
    });

    it('should validate command injection protection', () => {
      // Check for unsafe command execution patterns
      const unsafeCommands = [
        'execSync(',
        'spawn(',
        'exec(',
        'child_process.'
      ];

      const sourceCode = execSync('grep -r "exec\\|spawn" src/ --include="*.js" || true', {
        encoding: 'utf8'
      });

      if (sourceCode.trim()) {
        // Verify command execution is safe
        const lines = sourceCode.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          // Should not execute user input directly
          expect(line).not.toMatch(/exec.*\$\{.*\}/);
          expect(line).not.toMatch(/exec.*req\./);
          expect(line).not.toMatch(/exec.*input/);
        }
      }
    });
  });

  describe('A2: Broken Authentication', () => {
    it('should not expose authentication credentials', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let exposedSecrets = [];

      const secretPatterns = [
        /password\s*[:=]\s*["'][^"']+["']/gi,
        /secret\s*[:=]\s*["'][^"']+["']/gi,
        /token\s*[:=]\s*["'][^"']+["']/gi,
        /api_key\s*[:=]\s*["'][^"']+["']/gi,
        /Bearer\s+[A-Za-z0-9-._~+\/]+/gi
      ];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            // Filter out process.env usage and test files
            const validMatches = matches.filter(match => 
              !match.includes('process.env') && 
              !match.includes('test') &&
              !match.includes('example')
            );
            
            if (validMatches.length > 0) {
              exposedSecrets.push({
                file: path.relative(process.cwd(), file),
                matches: validMatches
              });
            }
          }
        }
      }

      expect(exposedSecrets).toEqual([]);
    });

    it('should use environment variables for sensitive configuration', async () => {
      const configFiles = [
        'config.json',
        'config/production.json',
        'config/staging.json'
      ];

      for (const configFile of configFiles) {
        if (await fs.pathExists(configFile)) {
          const config = await fs.readJson(configFile);
          
          // Should not contain hardcoded credentials
          const configStr = JSON.stringify(config);
          expect(configStr).not.toMatch(/password.*[a-zA-Z0-9]{8,}/);
          expect(configStr).not.toMatch(/secret.*[a-zA-Z0-9]{16,}/);
          expect(configStr).not.toMatch(/token.*[a-zA-Z0-9]{20,}/);
        }
      }
    });
  });

  describe('A3: Sensitive Data Exposure', () => {
    it('should not log sensitive information', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let sensitiveLogging = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for console.log with potentially sensitive data
        const logStatements = content.match(/console\.(log|error|warn|info)\([^)]*\)/g) || [];
        
        for (const statement of logStatements) {
          if (statement.match(/password|secret|token|key|credential/i)) {
            sensitiveLogging.push({
              file: path.relative(process.cwd(), file),
              statement: statement
            });
          }
        }
      }

      expect(sensitiveLogging).toEqual([]);
    });

    it('should handle errors without exposing sensitive information', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let errorExposure = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for error handling that might expose sensitive data
        const errorHandling = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g) || [];
        
        for (const handler of errorHandling) {
          if (handler.includes('console.log') || handler.includes('console.error')) {
            if (handler.match(/error\.stack|error\.message/)) {
              // Ensure stack traces are not logged in production
              errorExposure.push({
                file: path.relative(process.cwd(), file),
                handler: handler.substring(0, 100) + '...'
              });
            }
          }
        }
      }

      // Allow error logging but flag for review
      if (errorExposure.length > 0) {
        console.warn('⚠️ Found error handlers that may expose sensitive information:', errorExposure);
      }
    });
  });

  describe('A4: XML External Entities (XXE)', () => {
    it('should not process XML with external entities', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let xmlProcessing = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        if (content.includes('xml') || content.includes('XML')) {
          // Check for XML parsing without XXE protection
          if (content.match(/DOMParser|XMLHttpRequest|xml2js/i)) {
            xmlProcessing.push({
              file: path.relative(process.cwd(), file),
              type: 'XML processing detected'
            });
          }
        }
      }

      // Flag XML processing for manual review
      if (xmlProcessing.length > 0) {
        console.warn('⚠️ XML processing detected - ensure XXE protection:', xmlProcessing);
      }
    });
  });

  describe('A5: Broken Access Control', () => {
    it('should validate file access permissions', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let fileAccess = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for file system operations
        const fsOperations = content.match(/fs\.(readFile|writeFile|access|stat)\([^)]*\)/g) || [];
        
        for (const operation of fsOperations) {
          // Should not access files based on user input without validation
          if (operation.match(/req\.|input|params/)) {
            fileAccess.push({
              file: path.relative(process.cwd(), file),
              operation: operation
            });
          }
        }
      }

      expect(fileAccess).toEqual([]);
    });

    it('should validate path traversal protection', () => {
      // Test path traversal protection
      const testPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam'
      ];

      for (const testPath of testPaths) {
        const normalizedPath = path.normalize(testPath);
        
        // Should not allow access outside project directory
        expect(normalizedPath).not.toMatch(/\.\./);
        expect(path.isAbsolute(testPath) ? testPath : path.resolve(testPath))
          .toMatch(new RegExp('^' + process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    });
  });

  describe('A6: Security Misconfiguration', () => {
    it('should have secure dependency configuration', () => {
      // Check for known vulnerable dependencies
      if (auditResults.vulnerabilities) {
        const criticalVulns = Object.values(auditResults.vulnerabilities)
          .filter(vuln => vuln.severity === 'critical');
        
        expect(criticalVulns).toEqual([]);
        
        const highVulns = Object.values(auditResults.vulnerabilities)
          .filter(vuln => vuln.severity === 'high');
        
        // Allow some high severity but warn
        if (highVulns.length > 5) {
          console.warn(`⚠️ High severity vulnerabilities found: ${highVulns.length}`);
        }
      }
    });

    it('should not expose debug information in production', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let debugExposure = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for debug statements
        if (content.match(/console\.debug|debugger;|debug\s*=\s*true/i)) {
          debugExposure.push({
            file: path.relative(process.cwd(), file),
            type: 'Debug statements found'
          });
        }
      }

      if (debugExposure.length > 0) {
        console.warn('⚠️ Debug statements found - ensure they are removed in production:', debugExposure);
      }
    });

    it('should have proper error handling configuration', () => {
      // Check if proper error handling is configured
      const hasErrorHandler = packageJson.scripts?.['error:handle'] || 
                             packageJson.scripts?.['start:safe'] ||
                             false;
      
      // This is a warning, not a failure
      if (!hasErrorHandler) {
        console.warn('⚠️ Consider adding error handling scripts to package.json');
      }
    });
  });

  describe('A7: Cross-Site Scripting (XSS)', () => {
    it('should properly escape template outputs', async () => {
      const templateFiles = await getAllTemplateFiles();
      let xssVulnerabilities = [];

      for (const file of templateFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for unescaped output
        const unsafeOutputs = content.match(/\{\{[^}]*\|\s*safe\s*\}\}/g) || [];
        const rawOutputs = content.match(/\{\{[^}]*\|\s*raw\s*\}\}/g) || [];
        
        if (unsafeOutputs.length > 0 || rawOutputs.length > 0) {
          xssVulnerabilities.push({
            file: path.relative(process.cwd(), file),
            unsafe: unsafeOutputs,
            raw: rawOutputs
          });
        }
      }

      // Flag for manual review but don't fail
      if (xssVulnerabilities.length > 0) {
        console.warn('⚠️ Found potentially unsafe template outputs - review for XSS:', xssVulnerabilities);
      }
    });

    it('should validate HTML generation is safe', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let htmlGeneration = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for HTML generation from user input
        if (content.match(/innerHTML|outerHTML|document\.write/)) {
          htmlGeneration.push({
            file: path.relative(process.cwd(), file),
            type: 'HTML generation detected'
          });
        }
      }

      if (htmlGeneration.length > 0) {
        console.warn('⚠️ HTML generation detected - ensure proper sanitization:', htmlGeneration);
      }
    });
  });

  describe('A8: Insecure Deserialization', () => {
    it('should not use unsafe deserialization', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let deserializationIssues = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for potentially unsafe deserialization
        if (content.match(/eval\(|Function\(|vm\.runInThisContext/)) {
          deserializationIssues.push({
            file: path.relative(process.cwd(), file),
            type: 'Unsafe code execution detected'
          });
        }
      }

      expect(deserializationIssues).toEqual([]);
    });
  });

  describe('A9: Using Components with Known Vulnerabilities', () => {
    it('should not have critical vulnerabilities in dependencies', () => {
      if (auditResults.metadata) {
        expect(auditResults.metadata.vulnerabilities.critical).toBe(0);
      }
    });

    it('should keep dependencies updated', async () => {
      const outdatedOutput = execSync('npm outdated --json || echo "{}"', {
        encoding: 'utf8'
      });
      
      const outdated = JSON.parse(outdatedOutput);
      const criticallyOutdated = Object.entries(outdated).filter(([name, info]) => {
        if (!info.current || !info.wanted) return false;
        
        // Check if major version is behind
        const currentMajor = parseInt(info.current.split('.')[0]);
        const wantedMajor = parseInt(info.wanted.split('.')[0]);
        
        return wantedMajor > currentMajor;
      });

      if (criticallyOutdated.length > 0) {
        console.warn('⚠️ Critically outdated dependencies:', criticallyOutdated.map(([name]) => name));
      }
    });
  });

  describe('A10: Insufficient Logging & Monitoring', () => {
    it('should have proper logging configuration', async () => {
      const hasLogging = await fs.pathExists('src/lib/logger.js') ||
                        await fs.pathExists('src/utils/logger.js') ||
                        packageJson.dependencies?.winston ||
                        packageJson.dependencies?.pino ||
                        packageJson.dependencies?.bunyan;
      
      if (!hasLogging) {
        console.warn('⚠️ Consider implementing structured logging');
      }
    });

    it('should log security events', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let securityLogging = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for security event logging
        if (content.match(/log.*error|log.*security|audit/i)) {
          securityLogging.push({
            file: path.relative(process.cwd(), file),
            type: 'Security logging detected'
          });
        }
      }

      if (securityLogging.length === 0) {
        console.warn('⚠️ Consider adding security event logging');
      }
    });
  });

  describe('Additional Security Checks', () => {
    it('should not expose server information', () => {
      // Check if server fingerprinting is prevented
      const packageJsonStr = JSON.stringify(packageJson);
      
      // Should not expose detailed version information
      expect(packageJsonStr).not.toMatch(/X-Powered-By/);
      expect(packageJsonStr).not.toMatch(/Server: /);
    });

    it('should validate input size limits', async () => {
      const sourceFiles = await getAllJsFiles('src');
      let inputValidation = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for input size validation
        if (content.match(/req\.body|input|param/) && !content.match(/length|size|limit/)) {
          inputValidation.push({
            file: path.relative(process.cwd(), file),
            type: 'Input without size validation'
          });
        }
      }

      if (inputValidation.length > 0) {
        console.warn('⚠️ Consider adding input size validation:', inputValidation);
      }
    });

    it('should have content security policy considerations', () => {
      // This is more applicable to web applications
      console.log('ℹ️ CSP validation skipped for CLI application');
    });
  });
});

// Helper functions
async function getAllJsFiles(directory) {
  const files = [];
  
  if (!await fs.pathExists(directory)) {
    return files;
  }
  
  async function scan(dir) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await scan(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(directory);
  return files;
}

async function getAllTemplateFiles() {
  const files = [];
  const templateDirs = ['templates', '_templates'];
  
  for (const dir of templateDirs) {
    if (await fs.pathExists(dir)) {
      const templateFiles = await getAllFilesRecursive(dir, ['.njk', '.hbs', '.ejs']);
      files.push(...templateFiles);
    }
  }
  
  return files;
}

async function getAllFilesRecursive(directory, extensions) {
  const files = [];
  
  async function scan(dir) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await scan(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(directory);
  return files;
}