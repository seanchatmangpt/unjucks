/**
 * Test utilities for ontology project generation tests
 * London School TDD helpers with mocking support
 */

import fs from 'fs-extra';
import path from 'path';
import N3 from 'n3';
import { jest } from '@jest/globals';

/**
 * Generate a large ontology file programmatically for performance testing
 */
export async function generateLargeOntology(filePath, classCount = 1000) {
  const { DataFactory, Writer } = N3;
  const { namedNode, literal, quad } = DataFactory;

  const writer = new Writer({
    prefixes: {
      '': 'http://example.org/complex/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
    },
  });

  // Generate classes
  for (let i = 0; i < classCount; i++) {
    const className = `Entity${String(i).padStart(3, '0')}`;
    const classUri = namedNode(`http://example.org/complex/${className}`);

    writer.addQuad(
      quad(
        classUri,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/2000/01/rdf-schema#Class')
      )
    );

    writer.addQuad(
      quad(
        classUri,
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal(className)
      )
    );

    // Add properties for each class
    const propertyUri = namedNode(
      `http://example.org/complex/property${String(i).padStart(3, '0')}`
    );

    writer.addQuad(
      quad(
        propertyUri,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Property')
      )
    );

    writer.addQuad(
      quad(
        propertyUri,
        namedNode('http://www.w3.org/2000/01/rdf-schema#domain'),
        classUri
      )
    );

    writer.addQuad(
      quad(
        propertyUri,
        namedNode('http://www.w3.org/2000/01/rdf-schema#range'),
        namedNode('http://www.w3.org/2001/XMLSchema#string')
      )
    );
  }

  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        fs.ensureDir(path.dirname(filePath))
          .then(() => fs.writeFile(filePath, result))
          .then(() => resolve(result))
          .catch(reject);
      }
    });
  });
}

/**
 * Mock RDF parser for testing without actual file I/O
 */
export function createMockRDFParser() {
  return {
    parse: jest.fn().mockResolvedValue({
      classes: [],
      properties: [],
      relationships: [],
      imports: [],
    }),
    getClasses: jest.fn().mockReturnValue([]),
    getProperties: jest.fn().mockReturnValue([]),
    getRelationships: jest.fn().mockReturnValue([]),
    getImports: jest.fn().mockReturnValue([]),
    validateSyntax: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  };
}

/**
 * Mock file system for London School testing
 */
export function createMockFileSystem() {
  const fileStore = new Map();

  return {
    writeFile: jest.fn((path, content) => {
      fileStore.set(path, content);
      return Promise.resolve();
    }),
    readFile: jest.fn((path) => {
      if (!fileStore.has(path)) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(fileStore.get(path));
    }),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn((path) => Promise.resolve(fileStore.has(path))),
    remove: jest.fn((path) => {
      fileStore.delete(path);
      return Promise.resolve();
    }),
    getFiles: () => Array.from(fileStore.keys()),
    clear: () => fileStore.clear(),
  };
}

/**
 * Mock template engine for testing
 */
export function createMockTemplateEngine() {
  return {
    render: jest.fn((template, data) => {
      // Simple mock rendering
      let result = template;
      for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
      }
      return Promise.resolve(result);
    }),
    compile: jest.fn((template) => {
      return Promise.resolve({
        render: (data) => {
          let result = template;
          for (const [key, value] of Object.entries(data)) {
            result = result.replace(
              new RegExp(`{{\\s*${key}\\s*}}`, 'g'),
              value
            );
          }
          return result;
        },
      });
    }),
  };
}

/**
 * Validate generated TypeScript code syntax
 */
export async function validateTypeScriptSyntax(code) {
  const ts = await import('typescript');

  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  });

  return {
    valid: result.diagnostics.length === 0,
    errors: result.diagnostics.map((d) => ({
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      line: d.file?.getLineAndCharacterOfPosition(d.start || 0).line,
    })),
  };
}

/**
 * Compare generated files against golden files
 */
export async function compareWithGoldenFile(generatedPath, goldenPath) {
  const generated = await fs.readFile(generatedPath, 'utf-8');
  const golden = await fs.readFile(goldenPath, 'utf-8');

  // Normalize whitespace for comparison
  const normalize = (str) =>
    str
      .replace(/\r\n/g, '\n')
      .replace(/\s+$/gm, '')
      .trim();

  return {
    matches: normalize(generated) === normalize(golden),
    generated: normalize(generated),
    golden: normalize(golden),
  };
}

/**
 * Extract metrics from generated project
 */
export async function extractProjectMetrics(projectPath) {
  const metrics = {
    fileCount: 0,
    totalLines: 0,
    typeScriptFiles: 0,
    sqlFiles: 0,
    testFiles: 0,
    directories: new Set(),
  };

  async function walkDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        metrics.directories.add(fullPath);
        await walkDir(fullPath);
      } else {
        metrics.fileCount++;

        const ext = path.extname(entry.name);
        if (ext === '.ts') metrics.typeScriptFiles++;
        if (ext === '.sql') metrics.sqlFiles++;
        if (entry.name.includes('.test.') || entry.name.includes('.spec.'))
          metrics.testFiles++;

        const content = await fs.readFile(fullPath, 'utf-8');
        metrics.totalLines += content.split('\n').length;
      }
    }
  }

  if (await fs.pathExists(projectPath)) {
    await walkDir(projectPath);
  }

  return {
    ...metrics,
    directories: metrics.directories.size,
  };
}

/**
 * Create test spy for tracking function calls
 */
export function createSpy(name = 'spy') {
  const calls = [];
  const spy = jest.fn((...args) => {
    calls.push({ args, timestamp: Date.now() });
  });

  spy.getCalls = () => calls;
  spy.getCallCount = () => calls.length;
  spy.reset = () => calls.length = 0;

  return spy;
}

export default {
  generateLargeOntology,
  createMockRDFParser,
  createMockFileSystem,
  createMockTemplateEngine,
  validateTypeScriptSyntax,
  compareWithGoldenFile,
  extractProjectMetrics,
  createSpy,
};
