import path from 'node:path';
import { faker } from '@faker-js/faker';
import type { InjectionResult, InjectionOptions } from '../../src/lib/file-injector.js';

export interface TestFile {
  path: string;
  content: string;
  size: number;
  checksum?: string;
  metadata?: Record<string, any>;
}

export interface TestDirectory {
  path: string;
  files: TestFile[];
  subdirectories?: TestDirectory[];
}

export class FileFactory {
  /**
   * Create a test file
   */
  static createFile(overrides: Partial<TestFile> = {}): TestFile {
    const content = overrides.content || this.generateFileContent();
    
    return {
      path: overrides.path || this.generateFilePath(),
      content,
      size: overrides.size || Buffer.byteLength(content, 'utf8'),
      checksum: overrides.checksum || this.generateChecksum(content),
      metadata: overrides.metadata || {
        createdAt: faker.date.past(),
        modifiedAt: faker.date.recent(),
        permissions: '644'
      },
      ...overrides
    };
  }

  /**
   * Create multiple test files
   */
  static createFiles(count: number = 5): TestFile[] {
    return Array.from({ length: count }, () => this.createFile());
  }

  /**
   * Create test directory structure
   */
  static createDirectory(overrides: Partial<TestDirectory> = {}): TestDirectory {
    return {
      path: overrides.path || faker.system.directoryPath(),
      files: overrides.files || this.createFiles(3),
      subdirectories: overrides.subdirectories || [
        {
          path: path.join(overrides.path || 'test', 'subdir1'),
          files: this.createFiles(2)
        },
        {
          path: path.join(overrides.path || 'test', 'subdir2'),
          files: this.createFiles(2)
        }
      ],
      ...overrides
    };
  }

  /**
   * Create injection options
   */
  static createInjectionOptions(overrides: Partial<InjectionOptions> = {}): InjectionOptions {
    return {
      before: overrides.before || faker.lorem.sentence(),
      after: overrides.after || faker.lorem.sentence(),
      append: overrides.append ?? faker.datatype.boolean(),
      prepend: overrides.prepend ?? faker.datatype.boolean(),
      lineAt: overrides.lineAt || faker.datatype.number({ min: 1, max: 100 }),
      skipIf: overrides.skipIf || faker.lorem.word(),
      ...overrides
    };
  }

  /**
   * Create injection result
   */
  static createInjectionResult(overrides: Partial<InjectionResult> = {}): InjectionResult {
    return {
      success: overrides.success ?? true,
      modified: overrides.modified ?? true,
      skipped: overrides.skipped ?? false,
      reason: overrides.reason || (overrides.success ? 'Injection successful' : 'Injection failed'),
      linesAdded: overrides.linesAdded || faker.datatype.number({ min: 1, max: 10 }),
      originalContent: overrides.originalContent || faker.lorem.paragraphs(),
      modifiedContent: overrides.modifiedContent || faker.lorem.paragraphs(),
      ...overrides
    };
  }

  /**
   * Generate file path with realistic structure
   */
  static generateFilePath(type?: 'source' | 'test' | 'config' | 'doc'): string {
    const extensions = {
      source: ['.ts', '.js', '.tsx', '.jsx'],
      test: ['.test.ts', '.test.js', '.spec.ts', '.spec.js'],
      config: ['.json', '.yaml', '.yml', '.toml'],
      doc: ['.md', '.txt', '.rst']
    };

    const directories = {
      source: ['src', 'lib', 'components'],
      test: ['tests', '__tests__', 'spec'],
      config: ['config', 'configs', '.'],
      doc: ['docs', 'documentation', 'README']
    };

    const fileType = type || faker.helpers.arrayElement(['source', 'test', 'config', 'doc']);
    const dir = faker.helpers.arrayElement(directories[fileType]);
    const ext = faker.helpers.arrayElement(extensions[fileType]);
    const filename = faker.system.fileName();

    return path.join(dir, `${filename}${ext}`);
  }

  /**
   * Generate file content based on type
   */
  static generateFileContent(type?: 'typescript' | 'javascript' | 'json' | 'yaml' | 'markdown'): string {
    const contentType = type || faker.helpers.arrayElement([
      'typescript', 'javascript', 'json', 'yaml', 'markdown'
    ]);

    const templates = {
      typescript: `import { ${faker.hacker.noun()} } from './${faker.system.fileName()}';

export interface ${faker.hacker.noun()}Interface {
  id: string;
  name: string;
  description?: string;
}

export class ${faker.hacker.noun()}Service {
  private items: ${faker.hacker.noun()}Interface[] = [];

  async create(data: Omit<${faker.hacker.noun()}Interface, 'id'>): Promise<${faker.hacker.noun()}Interface> {
    const item = { ...data, id: crypto.randomUUID() };
    this.items.push(item);
    return item;
  }

  async findById(id: string): Promise<${faker.hacker.noun()}Interface | null> {
    return this.items.find(item => item.id === id) || null;
  }
}`,

      javascript: `const { ${faker.hacker.noun()} } = require('./${faker.system.fileName()}');

class ${faker.hacker.noun()}Manager {
  constructor() {
    this.items = [];
  }

  add(item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item');
    }
    
    this.items.push({
      ...item,
      id: Date.now().toString(),
      createdAt: new Date()
    });
  }

  getAll() {
    return [...this.items];
  }

  findById(id) {
    return this.items.find(item => item.id === id);
  }
}

module.exports = { ${faker.hacker.noun()}Manager };`,

      json: JSON.stringify({
        name: faker.commerce.productName(),
        version: faker.system.semver(),
        description: faker.lorem.sentence(),
        main: 'index.js',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          dev: 'vitest --watch'
        },
        dependencies: {
          [faker.hacker.noun()]: faker.system.semver(),
          [faker.hacker.noun()]: faker.system.semver()
        }
      }, null, 2),

      yaml: `name: ${faker.commerce.productName()}
version: ${faker.system.semver()}
description: ${faker.lorem.sentence()}

dependencies:
  - name: ${faker.hacker.noun()}
    version: ${faker.system.semver()}
  - name: ${faker.hacker.noun()}
    version: ${faker.system.semver()}

scripts:
  build: tsc
  test: vitest
  dev: vitest --watch

configuration:
  timeout: ${faker.datatype.number({ min: 1000, max: 60000 })}
  retries: ${faker.datatype.number({ min: 0, max: 5 })}
  verbose: ${faker.datatype.boolean()}`,

      markdown: `# ${faker.commerce.productName()}

${faker.lorem.paragraph()}

## Installation

\`\`\`bash
npm install ${faker.hacker.noun()}
\`\`\`

## Usage

\`\`\`typescript
import { ${faker.hacker.noun()} } from '${faker.hacker.noun()}';

const instance = new ${faker.hacker.noun()}();
await instance.initialize();
\`\`\`

## Features

- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`timeout\` | number | 5000 | ${faker.lorem.sentence()} |
| \`retries\` | number | 3 | ${faker.lorem.sentence()} |
| \`verbose\` | boolean | false | ${faker.lorem.sentence()} |

## License

MIT`
    };

    return templates[contentType];
  }

  /**
   * Generate file checksum
   */
  static generateChecksum(content: string): string {
    // Simple checksum for testing purposes
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create file system scenarios for testing
   */
  static createFileSystemScenarios() {
    return {
      emptyDirectory: {
        path: './empty',
        files: [],
        subdirectories: []
      },

      nestedStructure: {
        path: './project',
        files: [
          this.createFile({ path: './project/package.json', content: this.generateFileContent('json') }),
          this.createFile({ path: './project/README.md', content: this.generateFileContent('markdown') })
        ],
        subdirectories: [
          {
            path: './project/src',
            files: [
              this.createFile({ path: './project/src/index.ts', content: this.generateFileContent('typescript') }),
              this.createFile({ path: './project/src/utils.ts', content: this.generateFileContent('typescript') })
            ],
            subdirectories: [
              {
                path: './project/src/components',
                files: [
                  this.createFile({ path: './project/src/components/Button.tsx' }),
                  this.createFile({ path: './project/src/components/Input.tsx' })
                ]
              }
            ]
          },
          {
            path: './project/tests',
            files: [
              this.createFile({ path: './project/tests/index.test.ts' }),
              this.createFile({ path: './project/tests/utils.test.ts' })
            ]
          }
        ]
      },

      largeFiles: {
        path: './large',
        files: [
          this.createFile({
            path: './large/huge.json',
            content: JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({
              id: i,
              data: faker.lorem.paragraphs(10)
            })), null, 2)
          })
        ]
      },

      binaryFiles: {
        path: './binary',
        files: [
          this.createFile({
            path: './binary/image.png',
            content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('binary')
          }),
          this.createFile({
            path: './binary/archive.zip',
            content: Buffer.from([0x50, 0x4B, 0x03, 0x04]).toString('binary')
          })
        ]
      }
    };
  }

  /**
   * Create injection scenarios
   */
  static createInjectionScenarios() {
    const baseContent = `import React from 'react';

export const App = () => {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
};`;

    return {
      beforeImport: {
        file: this.createFile({ content: baseContent }),
        options: this.createInjectionOptions({
          before: 'import React from \'react\';',
          append: false
        }),
        injection: 'import { useState } from \'react\';',
        expected: `import { useState } from 'react';\nimport React from 'react';`
      },

      afterImport: {
        file: this.createFile({ content: baseContent }),
        options: this.createInjectionOptions({
          after: 'import React from \'react\';',
          append: true
        }),
        injection: 'import { useEffect } from \'react\';',
        expected: `import React from 'react';\nimport { useEffect } from 'react';`
      },

      append: {
        file: this.createFile({ content: baseContent }),
        options: this.createInjectionOptions({ append: true }),
        injection: 'export default App;',
        expected: baseContent + '\nexport default App;'
      },

      prepend: {
        file: this.createFile({ content: baseContent }),
        options: this.createInjectionOptions({ prepend: true }),
        injection: '/* eslint-disable */\n',
        expected: '/* eslint-disable */\n' + baseContent
      }
    };
  }
}

// Convenience exports
export const {
  createFile,
  createFiles,
  createDirectory,
  createInjectionOptions,
  createInjectionResult,
  generateFilePath,
  generateFileContent,
  generateChecksum,
  createFileSystemScenarios,
  createInjectionScenarios
} = FileFactory;