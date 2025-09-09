/**
 * Filesystem helper utilities for Unjucks testing
 * Provides specialized filesystem operations for test environments
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemHelper as BaseFileSystemHelper } from '../helpers.js';

/**
 * Enhanced FileSystemHelper with additional test-specific features
 */
export class FileSystemHelper extends BaseFileSystemHelper {
  constructor(basePath = null) {
    super(basePath);
    this.fixtures = new Map();
    this.snapshots = new Map();
  }

  /**
   * Create fixture files for testing
   */
  async createFixture(name, structure) {
    const fixturePath = await this.createTempDir();
    await this.createStructure(structure, fixturePath);
    this.fixtures.set(name, fixturePath);
    return fixturePath;
  }

  /**
   * Get fixture path by name
   */
  getFixture(name) {
    return this.fixtures.get(name);
  }

  /**
   * Create snapshot of directory structure
   */
  async createSnapshot(name, relativePath = '.') {
    const structure = await this.readStructure(relativePath);
    this.snapshots.set(name, structure);
    return structure;
  }

  /**
   * Compare current state with snapshot
   */
  async compareWithSnapshot(name, relativePath = '.') {
    const currentStructure = await this.readStructure(relativePath);
    const snapshotStructure = this.snapshots.get(name);
    
    if (!snapshotStructure) {
      throw new Error(`Snapshot '${name}' not found`);
    }
    
    return this.compareStructures(snapshotStructure, currentStructure);
  }

  /**
   * Compare two directory structures
   */
  compareStructures(expected, actual) {
    const differences = [];
    
    // Check for missing items in actual
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        differences.push(`Missing: ${key}`);
      } else if (typeof expected[key] === 'string' && actual[key] !== expected[key]) {
        differences.push(`Content mismatch in ${key}`);
      } else if (typeof expected[key] === 'object' && expected[key] !== null) {
        const subDiffs = this.compareStructures(expected[key], actual[key] || {});
        differences.push(...subDiffs.map(diff => `${key}/${diff}`));
      }
    }
    
    // Check for extra items in actual
    for (const key of Object.keys(actual)) {
      if (!(key in expected)) {
        differences.push(`Extra: ${key}`);
      }
    }
    
    return differences;
  }

  /**
   * Create test workspace with templates directory
   */
  async createTestWorkspace() {
    const workspace = await this.createTempDir();
    const templatesDir = path.join(workspace, '_templates');
    await fs.ensureDir(templatesDir);
    
    this.setBasePath(workspace);
    return workspace;
  }

  /**
   * Create a test template generator
   */
  async createTestGenerator(generatorName, templates = {}) {
    const generatorPath = path.join(this.basePath, '_templates', generatorName);
    await fs.ensureDir(generatorPath);

    for (const [templateName, templateContent] of Object.entries(templates)) {
      const templatePath = path.join(generatorPath, templateName);
      await fs.ensureDir(path.dirname(templatePath));
      await fs.writeFile(templatePath, templateContent);
    }

    return generatorPath;
  }

  /**
   * Create template with frontmatter
   */
  async createTemplate(generatorName, templateName, frontmatter = {}, content = '') {
    const templatePath = path.join(this.basePath, '_templates', generatorName, templateName);
    await fs.ensureDir(path.dirname(templatePath));
    
    let templateContent = content;
    if (Object.keys(frontmatter).length > 0) {
      const yamlFrontmatter = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`)
        .join('\n');
      templateContent = `---\n${yamlFrontmatter}\n---\n${content}`;
    }
    
    await fs.writeFile(templatePath, templateContent);
    return templatePath;
  }

  /**
   * Create package.json for testing
   */
  async createPackageJson(config = {}) {
    const defaultConfig = {
      name: 'test-package',
      version: '1.0.0',
      main: 'index.js',
      scripts: {
        test: 'echo "test"'
      }
    };
    
    const packageConfig = { ...defaultConfig, ...config };
    const packagePath = path.join(this.basePath, 'package.json');
    await fs.writeFile(packagePath, JSON.stringify(packageConfig, null, 2));
    return packagePath;
  }

  /**
   * Create unjucks.config.js for testing
   */
  async createUnjucksConfig(config = {}) {
    const defaultConfig = {
      templatesDir: '_templates',
      outputDir: 'src',
      extensions: ['.njk']
    };
    
    const unjucksConfig = { ...defaultConfig, ...config };
    const configPath = path.join(this.basePath, 'unjucks.config.js');
    const configContent = `export default ${JSON.stringify(unjucksConfig, null, 2)};`;
    await fs.writeFile(configPath, configContent);
    return configPath;
  }

  /**
   * Assert directory structure matches expected
   */
  async assertStructureMatches(expected, relativePath = '.') {
    const actual = await this.readStructure(relativePath);
    const differences = this.compareStructures(expected, actual);
    
    if (differences.length > 0) {
      throw new Error(`Directory structure mismatch:\n${differences.join('\n')}`);
    }
    
    return true;
  }

  /**
   * Assert file was created
   */
  async assertFileCreated(relativePath) {
    const exists = await this.exists(relativePath);
    if (!exists) {
      throw new Error(`Expected file to be created: ${relativePath}`);
    }
    return true;
  }

  /**
   * Assert file contains expected content
   */
  async assertFileContains(relativePath, expectedContent) {
    const content = await this.readFile(relativePath);
    if (!content) {
      throw new Error(`File does not exist: ${relativePath}`);
    }
    if (!content.includes(expectedContent)) {
      throw new Error(`File ${relativePath} does not contain expected content: ${expectedContent}`);
    }
    return true;
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats() {
    const stats = {
      totalFiles: 0,
      totalDirectories: 0,
      generators: 0,
      templates: 0
    };

    async function countRecursive(dir) {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            stats.totalDirectories++;
            if (itemPath.includes('_templates')) {
              stats.generators++;
            }
            await countRecursive(itemPath);
          } else if (item.isFile()) {
            stats.totalFiles++;
            if (item.name.endsWith('.njk')) {
              stats.templates++;
            }
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    }
    
    await countRecursive(this.basePath);
    return stats;
  }

  /**
   * Clean up fixtures and snapshots in addition to regular cleanup
   */
  async cleanup() {
    await super.cleanup();
    
    // Clean up fixtures
    for (const [name, fixturePath] of this.fixtures) {
      try {
        await fs.remove(fixturePath);
      } catch (error) {
        console.warn(`Failed to cleanup fixture ${name}:`, error);
      }
    }
    this.fixtures.clear();
    
    // Clear snapshots
    this.snapshots.clear();
  }
}

/**
 * Create a new enhanced FileSystemHelper instance
 */
export function createFileSystemHelper(basePath = null) {
  return new FileSystemHelper(basePath);
}

export default FileSystemHelper;