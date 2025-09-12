/**
 * UnjucksWorld class for BDD-style test support
 * Provides a test environment with MCP integration capabilities
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { TestHelper } from './TestHelper.js';

export class UnjucksWorld {
  constructor() {
    this.tempDir = null;
    this.helper = null;
    this.performanceMetrics = {
      startTime: null,
      endTime: null,
      operations: []
    };
    this.mcpAvailable = false;
  }

  /**
   * Setup temporary directory for test
   */
  async setupTempDir() {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-world-'));
    this.helper = new TestHelper(this.tempDir);
    
    // Create basic directory structure
    await fs.ensureDir(path.join(this.tempDir, '_templates'));
    await fs.ensureDir(path.join(this.tempDir, 'src'));
    await fs.ensureDir(path.join(this.tempDir, 'tests'));
    await fs.ensureDir(path.join(this.tempDir, '.unjucks'));
    
    // Change to temp directory for tests
    process.chdir(this.tempDir);
  }

  /**
   * Clean up temporary directory
   */
  async cleanupTempDirectory() {
    if (this.helper) {
      await this.helper.cleanup();
    }
    if (this.tempDir && await fs.pathExists(this.tempDir)) {
      await fs.remove(this.tempDir);
    }
    this.tempDir = null;
    this.helper = null;
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    this.performanceMetrics.startTime = performance.now();
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    this.performanceMetrics.endTime = performance.now();
    return {
      duration: this.performanceMetrics.endTime - this.performanceMetrics.startTime,
      operations: this.performanceMetrics.operations
    };
  }

  /**
   * Record performance operation
   */
  recordOperation(operation, startTime, endTime) {
    this.performanceMetrics.operations.push({
      operation,
      duration: endTime - startTime,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Check if MCP is available
   */
  async checkMCPAvailability() {
    try {
      // Try a simple command that would use MCP
      const result = await this.helper.runCli('swarm status');
      this.mcpAvailable = result.exitCode === 0 && !result.stderr.match(/(connection|server|MCP)/i);
      return this.mcpAvailable;
    } catch {
      this.mcpAvailable = false;
      return false;
    }
  }

  /**
   * Simulate MCP tool call
   * This is a mock implementation since we don't have real MCP in test environment
   */
  async callMCPTool(toolName, args = {}) {
    // Mock MCP responses for testing
    switch (toolName) {
      case 'unjucks_list':
        return {
          success: true,
          result: {
            generators: this.helper ? await this.scanGenerators() : []
          }
        };
      
      case 'unjucks_help':
        return {
          success: true,
          result: {
            generator: args.generator || 'test-generator',
            template: args.template || 'test-template',
            variables: {
              name: { type: 'string', required: true, description: 'Component name' },
              withProps: { type: 'boolean', required: false, description: 'Include props interface' }
            }
          }
        };
      
      case 'unjucks_generate':
        return {
          success: true,
          result: {
            generator: args.generator || 'test-generator',
            template: args.template || 'test-template',
            variables: args.variables || {},
            filesCreated: [
              `src/components/${args.variables?.name || 'TestComponent'}.tsx`
            ]
          }
        };
      
      case 'unjucks_dry_run':
        return {
          success: true,
          result: {
            preview: true,
            files: [
              {
                path: `src/components/${args.variables?.name || 'TestComponent'}.tsx`,
                content: `export const ${args.variables?.name || 'TestComponent'} = () => <div>Test</div>;`
              }
            ]
          }
        };
      
      default:
        return {
          success: false,
          error: `Unknown MCP tool: ${toolName}`
        };
    }
  }

  /**
   * Scan for generators in the templates directory
   */
  async scanGenerators() {
    if (!this.tempDir) return [];
    
    const templatesDir = path.join(this.tempDir, '_templates');
    if (!await fs.pathExists(templatesDir)) return [];
    
    const generators = [];
    const entries = await fs.readdir(templatesDir);
    
    for (const entry of entries) {
      const generatorPath = path.join(templatesDir, entry);
      const stat = await fs.stat(generatorPath);
      
      if (stat.isDirectory()) {
        generators.push({
          name: entry,
          path: generatorPath,
          description: `Generator for ${entry}`,
          templates: await this.scanTemplates(generatorPath)
        });
      }
    }
    
    return generators;
  }

  /**
   * Scan for templates in a generator directory
   */
  async scanTemplates(generatorPath) {
    const templates = [];
    
    try {
      const entries = await fs.readdir(generatorPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templatePath = path.join(generatorPath, entry.name);
          const templateFiles = await fs.readdir(templatePath);
          
          templates.push({
            name: entry.name,
            path: templatePath,
            files: templateFiles.filter(file => file.endsWith('.njk'))
          });
        }
      }
    } catch (error) {
      // Ignore errors in template scanning
    }
    
    return templates;
  }

  /**
   * Create test file structure
   */
  async createTestFiles(files) {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.tempDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  /**
   * Run CLI command through helper
   */
  async runCli(command, options = {}) {
    return this.helper?.runCli(command, options) || {
      exitCode: 1,
      stdout: '',
      stderr: 'Helper not initialized',
      success: false
    };
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Read file content
   */
  async readFile(filePath) {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath) {
    const fullPath = path.join(this.tempDir, dirPath);
    await fs.ensureDir(fullPath);
  }

  /**
   * Create file with content
   */
  async createFile(filePath, content) {
    const fullPath = path.join(this.tempDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }

  /**
   * Validate generated file content
   */
  async validateFileContent(filePath, expectedPatterns) {
    const content = await this.readFile(filePath);
    const errors = [];

    for (const pattern of expectedPatterns) {
      const regex = new RegExp(pattern);
      if (!regex.test(content)) {
        errors.push(`Pattern not found: ${pattern}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      content
    };
  }
}

export default UnjucksWorld;