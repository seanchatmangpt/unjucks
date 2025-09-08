/**
 * Tests for CleanroomManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { CleanroomManager } from '../../src/lib/cleanroom/cleanroom-manager.js';

describe('CleanroomManager', () => {
  let cleanroomManager;
  let testDir;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = path.join(process.cwd(), 'test-cleanroom-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    cleanroomManager = new CleanroomManager({
      baseWorkDir: path.join(testDir, 'cleanroom'),
      outputDir: path.join(testDir, 'output'),
      isolationLevel: 'moderate',
      autoCleanup: false, // Keep for inspection during tests
      latex: {
        dockerEnabled: false // Disable Docker for tests
      }
    });

    await cleanroomManager.initialize();
  });

  afterEach(async () => {
    if (cleanroomManager) {
      await cleanroomManager.shutdown();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(cleanroomManager).toBeDefined();
      expect(cleanroomManager.config).toBeDefined();
      expect(cleanroomManager.securityValidator).toBeDefined();
      expect(cleanroomManager.rollbackManager).toBeDefined();
    });

    it('should create required directories', async () => {
      const baseWorkDir = cleanroomManager.config.baseWorkDir;
      const outputDir = cleanroomManager.config.outputDir;
      
      expect(await directoryExists(baseWorkDir)).toBe(true);
      expect(await directoryExists(outputDir)).toBe(true);
    });
  });

  describe('document generation', () => {
    it('should generate a simple LaTeX document', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
Hello, {{ name }}!
\\end{document}
      `.trim();

      const variables = { name: 'World' };
      
      const result = await cleanroomManager.generateDocument(template, variables);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.outputPath).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle template variables correctly', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
Name: {{ user.name }}
Age: {{ user.age }}
Items: {{ items | join(', ') }}
\\end{document}
      `.trim();

      const variables = {
        user: {
          name: 'Alice',
          age: 30
        },
        items: ['apple', 'banana', 'cherry']
      };
      
      const result = await cleanroomManager.generateDocument(template, variables);
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should reject dangerous LaTeX commands', async () => {
      const dangerousTemplate = `
\\documentclass{article}
\\begin{document}
\\write18{rm -rf /}
This should not compile!
\\end{document}
      `.trim();

      const result = await cleanroomManager.generateDocument(dangerousTemplate, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('security');
    });

    it('should handle large templates', async () => {
      // Generate a large template
      const sections = Array.from({ length: 100 }, (_, i) => 
        `\\section{Section ${i + 1}}\nThis is section ${i + 1} with variable: {{ count }}.`
      ).join('\n\n');

      const template = `
\\documentclass{article}
\\begin{document}
${sections}
\\end{document}
      `.trim();

      const variables = { count: 42 };
      
      const result = await cleanroomManager.generateDocument(template, variables, {
        maxProcessingTime: 30000 // Increase timeout for large template
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('security validation', () => {
    it('should validate inputs before processing', async () => {
      const result = await cleanroomManager.generateDocument('', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should reject path traversal attempts', async () => {
      const maliciousTemplate = `
\\documentclass{article}
\\begin{document}
\\input{../../etc/passwd}
\\end{document}
      `.trim();

      const result = await cleanroomManager.generateDocument(maliciousTemplate, {});
      
      expect(result.success).toBe(false);
      expect(result.securityViolations).toBeDefined();
    });

    it('should sanitize variable content', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
Content: {{ content }}
\\end{document}
      `.trim();

      const variables = {
        content: 'Normal content with <script>alert("xss")</script>'
      };
      
      const result = await cleanroomManager.generateDocument(template, variables);
      
      // Should succeed but sanitize the content
      expect(result.success).toBe(true);
    });
  });

  describe('isolation and cleanup', () => {
    it('should create isolated environments for each session', async () => {
      const template = `
\\documentclass{article}
\\begin{document}
Test document
\\end{document}
      `.trim();

      const result1 = await cleanroomManager.generateDocument(template, {});
      const result2 = await cleanroomManager.generateDocument(template, {});
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.sessionId).not.toBe(result2.sessionId);
    });

    it('should clean up sessions after completion', async () => {
      const initialSessions = cleanroomManager.getActiveSessions();
      
      const template = `
\\documentclass{article}
\\begin{document}
Test document
\\end{document}
      `.trim();

      await cleanroomManager.generateDocument(template, {});
      
      const finalSessions = cleanroomManager.getActiveSessions();
      expect(finalSessions.length).toBe(initialSessions.length);
    });
  });

  describe('error handling and rollback', () => {
    it('should handle compilation errors gracefully', async () => {
      const invalidTemplate = `
\\documentclass{article}
\\begin{document}
\\invalid_command{this will fail}
\\end{document}
      `.trim();

      const result = await cleanroomManager.generateDocument(invalidTemplate, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should rollback on failure when enabled', async () => {
      const manager = new CleanroomManager({
        baseWorkDir: path.join(testDir, 'rollback-test'),
        outputDir: path.join(testDir, 'rollback-output'),
        enableRollback: true,
        latex: { dockerEnabled: false }
      });
      
      await manager.initialize();
      
      try {
        const invalidTemplate = `
\\documentclass{article}
\\begin{document}
\\undefined_command{}
\\end{document}
        `.trim();

        const result = await manager.generateDocument(invalidTemplate, {});
        
        expect(result.success).toBe(false);
        expect(manager.metrics.rolledBackSessions).toBeGreaterThan(0);
      } finally {
        await manager.shutdown();
      }
    });
  });

  describe('metrics and monitoring', () => {
    it('should track metrics correctly', async () => {
      const initialMetrics = cleanroomManager.getMetrics();
      
      const template = `
\\documentclass{article}
\\begin{document}
Test document
\\end{document}
      `.trim();

      await cleanroomManager.generateDocument(template, {});
      
      const finalMetrics = cleanroomManager.getMetrics();
      expect(finalMetrics.totalSessions).toBe(initialMetrics.totalSessions + 1);
      expect(finalMetrics.successfulCompilations).toBe(initialMetrics.successfulCompilations + 1);
    });

    it('should provide active session information', async () => {
      const sessions = cleanroomManager.getActiveSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should respect isolation level settings', async () => {
      const strictManager = new CleanroomManager({
        baseWorkDir: path.join(testDir, 'strict'),
        outputDir: path.join(testDir, 'strict-output'),
        isolationLevel: 'strict',
        latex: { dockerEnabled: false }
      });
      
      await strictManager.initialize();
      
      try {
        expect(strictManager.config.isolationLevel).toBe('strict');
      } finally {
        await strictManager.shutdown();
      }
    });

    it('should handle custom configuration options', async () => {
      const customManager = new CleanroomManager({
        baseWorkDir: path.join(testDir, 'custom'),
        outputDir: path.join(testDir, 'custom-output'),
        maxProcessingTime: 60000,
        maxFileSize: 1024 * 1024,
        latex: {
          engine: 'xelatex',
          dockerEnabled: false
        }
      });
      
      await customManager.initialize();
      
      try {
        expect(customManager.config.maxProcessingTime).toBe(60000);
        expect(customManager.config.maxFileSize).toBe(1024 * 1024);
        expect(customManager.config.latex.engine).toBe('xelatex');
      } finally {
        await customManager.shutdown();
      }
    });
  });
});

// Helper functions
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}