/**
 * Test utilities and helpers
 */

import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

/**
 * Create a temporary directory for testing
 * @returns {Promise<string>} Path to temporary directory
 */
export async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), 'unjucks-test-' + this.getDeterministicTimestamp() + '-' + Math.random().toString(36).substr(2, 9));
  await fs.ensureDir(tempDir);
  return tempDir;
}

/**
 * Clean up temporary directory
 * @param {string} tempDir - Path to temporary directory
 */
export async function cleanupTempDir(tempDir) {
  if (tempDir && tempDir.includes('unjucks-test-')) {
    await fs.remove(tempDir);
  }
}

/**
 * Create a test template structure
 * @param {string} baseDir - Base directory for templates
 * @param {Object} structure - Template structure definition
 */
export async function createTestTemplates(baseDir, structure) {
  for (const [generatorName, templates] of Object.entries(structure)) {
    const generatorDir = path.join(baseDir, generatorName);
    await fs.ensureDir(generatorDir);
    
    for (const [templateName, content] of Object.entries(templates)) {
      const templatePath = path.join(generatorDir, `${templateName}.njk`);
      await fs.writeFile(templatePath, content);
    }
  }
}

/**
 * Create a mock template with frontmatter
 * @param {Object} frontmatter - Frontmatter object
 * @param {string} content - Template content
 * @returns {string} Complete template content
 */
export function createMockTemplate(frontmatter, content) {
  const yamlFrontmatter = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  
  return `---\n${yamlFrontmatter}\n---\n${content}`;
}

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture console output during test execution
 * @param {Function} fn - Function to execute
 * @returns {Promise<{result: any, logs: string[], errors: string[]}>}
 */
export async function captureConsole(fn) {
  const logs = [];
  const errors = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => logs.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));
  
  try {
    const result = await fn();
    return { result, logs, errors };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/**
 * Create a test file with specified content
 * @param {string} filePath - Path to create file
 * @param {string} content - File content
 */
export async function createTestFile(filePath, content) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Assert that a file exists and contains expected content
 * @param {string} filePath - Path to file
 * @param {string|RegExp} expectedContent - Expected content or pattern
 */
export async function assertFileContent(filePath, expectedContent) {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const content = await fs.readFile(filePath, 'utf8');
  
  if (typeof expectedContent === 'string') {
    if (!content.includes(expectedContent)) {
      throw new Error(`File ${filePath} does not contain expected content: ${expectedContent}`);
    }
  } else if (expectedContent instanceof RegExp) {
    if (!expectedContent.test(content)) {
      throw new Error(`File ${filePath} does not match expected pattern: ${expectedContent}`);
    }
  }
  
  return content;
}

/**
 * Mock file system operations
 * @returns {Object} Mock functions
 */
export function createFsMocks() {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  };
}

/**
 * Create a test generator structure
 * @param {string} name - Generator name
 * @param {Array<string>} templates - Template names
 * @returns {Object} Generator structure
 */
export function createTestGenerator(name, templates) {
  const structure = {};
  structure[name] = {};
  
  templates.forEach(templateName => {
    structure[name][templateName] = createMockTemplate(
      { to: `{{ name }}.${templateName}.js` },
      `// Generated ${templateName} for {{ name }}`
    );
  });
  
  return structure;
}

/**
 * Validate test result structure
 * @param {Object} result - Result object to validate
 * @param {Array<string>} requiredFields - Required fields
 */
export function validateTestResult(result, requiredFields = ['success']) {
  requiredFields.forEach(field => {
    if (!(field in result)) {
      throw new Error(`Result missing required field: ${field}`);
    }
  });
}

/**
 * Create test variables for template generation
 * @param {Object} overrides - Variable overrides
 * @returns {Object} Test variables
 */
export function createTestVariables(overrides = {}) {
  return {
    name: 'TestComponent',
    type: 'component',
    author: 'Test Author',
    description: 'Test description',
    ...overrides
  };
}

/**
 * Generate random test data
 * @param {string} type - Type of data to generate
 * @returns {any} Generated data
 */
export function generateTestData(type) {
  switch (type) {
    case 'string':
      return 'test-' + Math.random().toString(36).substr(2, 8);
    case 'number':
      return Math.floor(Math.random() * 1000);
    case 'boolean':
      return Math.random() > 0.5;
    case 'array':
      return Array.from({ length: 3 }, (_, i) => `item-${i}`);
    case 'object':
      return {
        id: Math.random().toString(36).substr(2, 8),
        value: Math.random(),
        active: true
      };
    default:
      return null;
  }
}