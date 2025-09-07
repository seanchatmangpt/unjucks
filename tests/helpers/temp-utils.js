/**
 * Temporary file and directory utilities for testing
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary directory for testing
 * @returns {Promise<string>} Path to temporary directory
 */
export async function createTempDirectory() {
  const tempDir = path.join(tmpdir(), 'unjucks-test-' + Date.now() + '-' + Math.random().toString(36).substring(2));
  await fs.ensureDir(tempDir);
  return tempDir;
}

/**
 * Clean up temporary directory
 * @param {string} tempDir - Path to temporary directory
 * @returns {Promise<void>}
 */
export async function cleanupTempDirectory(tempDir) {
  try {
    await fs.remove(tempDir);
  } catch (error) {
    console.warn('Failed to cleanup temp directory:', tempDir, error);
  }
}

/**
 * Create a temporary file with content
 * @param {string} content - File content
 * @param {string} extension - File extension (default: '.tmp')
 * @returns {Promise<string>} Path to temporary file
 */
export async function createTempFile(content, extension = '.tmp') {
  const tempDir = await createTempDirectory();
  const tempFile = path.join(tempDir, 'test-file' + extension);
  await fs.writeFile(tempFile, content);
  return tempFile;
}

/**
 * Create a temporary template structure for testing
 * @param {Object} structure - Template structure definition
 * @returns {Promise<string>} Path to templates directory
 */
export async function createTempTemplateStructure(structure) {
  const tempDir = await createTempDirectory();
  const templatesDir = path.join(tempDir, '_templates');
  
  await createDirectoryStructure(templatesDir, structure);
  return templatesDir;
}

/**
 * Recursively create directory structure from object definition
 * @param {string} basePath - Base path to create structure in
 * @param {Object} structure - Structure definition
 * @returns {Promise<void>}
 */
async function createDirectoryStructure(basePath, structure) {
  await fs.ensureDir(basePath);
  
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(basePath, name);
    
    if (typeof content === 'string') {
      // It's a file
      await fs.writeFile(fullPath, content);
    } else if (typeof content === 'object' && content !== null) {
      // It's a directory
      await createDirectoryStructure(fullPath, content);
    }
  }
}

/**
 * Read directory structure into an object
 * @param {string} dirPath - Directory path to read
 * @returns {Promise<Object>} Directory structure object
 */
export async function readDirectoryStructure(dirPath) {
  const structure = {};
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        structure[item.name] = await readDirectoryStructure(itemPath);
      } else if (item.isFile()) {
        structure[item.name] = await fs.readFile(itemPath, 'utf8');
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    return {};
  }
  
  return structure;
}

/**
 * Compare two directory structures
 * @param {Object} expected - Expected structure
 * @param {Object} actual - Actual structure
 * @returns {Array} Array of differences
 */
export function compareStructures(expected, actual) {
  const differences = [];
  
  // Check for missing items in actual
  for (const key of Object.keys(expected)) {
    if (!(key in actual)) {
      differences.push(`Missing: ${key}`);
    } else if (typeof expected[key] === 'string' && actual[key] !== expected[key]) {
      differences.push(`Content mismatch in ${key}`);
    } else if (typeof expected[key] === 'object' && expected[key] !== null) {
      const subDiffs = compareStructures(expected[key], actual[key] || {});
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
 * Create a mock generator configuration
 * @returns {Object} Mock generator configuration
 */
export function createMockGeneratorConfig() {
  return {
    name: 'test-generator',
    description: 'Test generator for validation',
    templates: {
      'basic': {
        'component.njk': `---
to: "{{ dest }}/{{ name | pascalCase }}.js"
---
export const {{ name | pascalCase }} = {
  name: '{{ name | titleCase }}',
  slug: '{{ name | kebabCase }}'
};`
      },
      'complex': {
        'full-component.njk': `---
to: "{{ dest }}/components/{{ name | pascalCase }}/index.js"
inject: false
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return (
    <div className="{{ name | kebabCase }}-component">
      <h1>{{ name | titleCase }}</h1>
      <p>Created: {{ now() | formatDate('YYYY-MM-DD') }}</p>
      <p>ID: {{ '' | fakeUuid }}</p>
    </div>
  );
};

export default {{ name | pascalCase }};`,
        'test.njk': `---
to: "{{ dest }}/components/{{ name | pascalCase }}/{{ name | pascalCase }}.test.js"
---
import { render } from '@testing-library/react';
import { {{ name | pascalCase }} } from './index';

describe('{{ name | pascalCase }}', () => {
  it('renders correctly', () => {
    const { getByText } = render(<{{ name | pascalCase }} />);
    expect(getByText('{{ name | titleCase }}')).toBeInTheDocument();
  });
});`
      }
    }
  };
}