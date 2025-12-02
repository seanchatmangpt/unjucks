/**
 * BDD Step Definitions for Ontology Project Generation
 * London School TDD - Uses test doubles and mocks
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import N3 from 'n3';

// Test context to share state between steps
class TestContext {
  constructor() {
    this.ontologyFile = null;
    this.classCount = 0;
    this.propertyCount = 0;
    this.relationshipCount = 0;
    this.commandOutput = null;
    this.commandError = null;
    this.exitCode = 0;
    this.generatedFiles = new Set();
    this.customCodeBlocks = [];
    this.executionTime = 0;
    this.memoryUsage = 0;
  }

  reset() {
    this.ontologyFile = null;
    this.classCount = 0;
    this.propertyCount = 0;
    this.relationshipCount = 0;
    this.commandOutput = null;
    this.commandError = null;
    this.exitCode = 0;
    this.generatedFiles.clear();
    this.customCodeBlocks = [];
    this.executionTime = 0;
    this.memoryUsage = 0;
  }
}

const context = new TestContext();

// Mock dependencies for London School TDD
const mockRDFParser = {
  parse: jest.fn(),
  getClasses: jest.fn(),
  getProperties: jest.fn(),
  getRelationships: jest.fn(),
};

const mockFileSystem = {
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readFile: jest.fn(),
  exists: jest.fn(),
};

const mockTemplateEngine = {
  render: jest.fn(),
  compile: jest.fn(),
};

// Cleanup before/after each scenario
Before(function () {
  context.reset();
  jest.clearAllMocks();
});

After(async function () {
  // Cleanup generated test directories
  const testDirs = [
    './generated/test-project',
    './generated/large-project',
    './generated/import-project',
    './generated/dry-project',
    './generated/custom-project',
    './generated/invalid-project',
    './generated/incomplete-project',
    './generated/circular-project',
    './generated/multi-format',
    './generated/i18n-project',
    './generated/shacl-project',
    './generated/bench-project',
    './generated/incremental-project',
    './generated/openapi-project',
    './generated/docker-project',
    './generated/cicd-project',
  ];

  for (const dir of testDirs) {
    await fs.remove(dir).catch(() => {});
  }
});

// Background Steps
Given('an RDF ontology file {string}', async function (filePath) {
  context.ontologyFile = filePath;

  // Ensure fixture exists
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Ontology fixture not found: ${filePath}`);
  }

  // Mock RDF parser to return parsed ontology
  mockRDFParser.parse.mockResolvedValue({
    classes: [],
    properties: [],
    relationships: [],
  });
});

Given('the ontology contains {int} classes', function (count) {
  context.classCount = count;

  // Mock getClasses to return specified count
  const mockClasses = Array.from({ length: count }, (_, i) => ({
    uri: `http://example.org/Class${i}`,
    label: `Class${i}`,
    properties: [],
  }));

  mockRDFParser.getClasses.mockReturnValue(mockClasses);
});

Given('the ontology contains {int} properties', function (count) {
  context.propertyCount = count;

  // Mock getProperties
  const mockProperties = Array.from({ length: count }, (_, i) => ({
    uri: `http://example.org/property${i}`,
    label: `property${i}`,
    range: 'xsd:string',
  }));

  mockRDFParser.getProperties.mockReturnValue(mockProperties);
});

Given('the ontology contains {int} relationships', function (count) {
  context.relationshipCount = count;

  // Mock getRelationships
  const mockRelationships = Array.from({ length: count }, (_, i) => ({
    subject: `Class${i % 5}`,
    predicate: `relatesTo`,
    object: `Class${(i + 1) % 5}`,
  }));

  mockRDFParser.getRelationships.mockReturnValue(mockRelationships);
});

Given('an invalid RDF file {string}', async function (filePath) {
  context.ontologyFile = filePath;

  // Create invalid TTL file for testing
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(
    filePath,
    `
@prefix : <http://example.org/> .
:Person a rdfs:Class
  # Missing closing ; - invalid syntax
  :name "Test"
  :age 30
`
  );
});

Given('the ontology is missing rdfs:Class definitions', async function () {
  // Mock parser to return empty classes
  mockRDFParser.getClasses.mockReturnValue([]);
});

Given('class {string} references class {string}', function (class1, class2) {
  // Mock circular dependency
  mockRDFParser.getRelationships.mockReturnValue([
    { subject: class1, predicate: 'referencesTo', object: class2 },
    { subject: class2, predicate: 'referencesTo', object: class1 },
  ]);
});

Given('the ontology imports {string}', function (importUri) {
  // Mock ontology with imports
  mockRDFParser.parse.mockResolvedValue({
    imports: [importUri],
    classes: [],
    properties: [],
  });
});

Given('the ontology has labels in English, Spanish, and French', function () {
  // Mock i18n labels
  mockRDFParser.getClasses.mockReturnValue([
    {
      uri: 'http://example.org/Person',
      labels: {
        en: 'Person',
        es: 'Persona',
        fr: 'Personne',
      },
    },
  ]);
});

Given('a SHACL shapes file {string}', async function (shapesFile) {
  await fs.ensureDir(path.dirname(shapesFile));
  await fs.writeFile(
    shapesFile,
    `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [
    sh:path ex:email ;
    sh:pattern "^[^@]+@[^@]+$" ;
  ] .
`
  );
});

Given('a custom template directory {string}', async function (templateDir) {
  await fs.ensureDir(templateDir);
  await fs.writeFile(
    path.join(templateDir, 'entity.ts.njk'),
    `
import { Entity, Column } from 'typeorm';

@Entity()
class {{ className }}Entity {
  {% for property in properties %}
  @Column()
  {{ property.name }}: {{ property.type }};
  {% endfor %}
}
`
  );
});

Given(
  'a previously generated project at {string}',
  async function (projectPath) {
    await fs.ensureDir(path.join(projectPath, 'src/models'));
    await fs.writeFile(
      path.join(projectPath, 'src/models/Person.ts'),
      `
interface Person {
  id: string;
  name: string;

  // CUSTOM CODE START
  customMethod() {
    return 'custom logic';
  }
  // CUSTOM CODE END
}
`
    );

    context.customCodeBlocks.push({
      file: 'Person.ts',
      content: 'customMethod() { return "custom logic"; }',
    });
  }
);

Given(
  'file {string} has custom methods',
  async function (relativeFilePath) {
    // Already handled in previous step
    expect(context.customCodeBlocks.length).to.be.greaterThan(0);
  }
);

// When Steps
When('I run {string}', async function (command) {
  const fullCommand = `node bin/kgen ${command}`;

  try {
    const startTime = Date.now();
    const startMem = process.memoryUsage().heapUsed;

    context.commandOutput = execSync(fullCommand, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    context.executionTime = Date.now() - startTime;
    context.memoryUsage = process.memoryUsage().heapUsed - startMem;
    context.exitCode = 0;
  } catch (error) {
    context.commandError = error.stderr || error.message;
    context.exitCode = error.status || 1;
    context.commandOutput = error.stdout || '';
  }
});

// Then Steps - File System Assertions
Then('directory {string} should exist', async function (dirPath) {
  const exists = await fs.pathExists(dirPath);
  expect(exists, `Directory ${dirPath} should exist`).to.be.true;
});

Then('directory {string} should not exist', async function (dirPath) {
  const exists = await fs.pathExists(dirPath);
  expect(exists, `Directory ${dirPath} should not exist`).to.be.false;
});

Then('file {string} should exist', async function (filePath) {
  const exists = await fs.pathExists(filePath);
  expect(exists, `File ${filePath} should exist`).to.be.true;

  context.generatedFiles.add(filePath);
});

Then('file {string} should contain {string}', async function (file, content) {
  // Resolve file path from context if relative
  let filePath = file;
  if (!file.startsWith('./')) {
    const lastGenerated = Array.from(context.generatedFiles).pop();
    if (lastGenerated && lastGenerated.includes(file)) {
      filePath = lastGenerated;
    }
  }

  const fileContent = await fs.readFile(filePath, 'utf-8');
  expect(
    fileContent,
    `File ${filePath} should contain "${content}"`
  ).to.include(content);
});

Then(
  'directory {string} should contain {int} files',
  async function (dirPath, count) {
    const files = await fs.readdir(dirPath);
    expect(files.length, `Directory should contain ${count} files`).to.equal(
      count
    );
  }
);

// Then Steps - Command Output Assertions
Then('stdout should contain {string}', function (expectedOutput) {
  expect(
    context.commandOutput,
    `stdout should contain "${expectedOutput}"`
  ).to.include(expectedOutput);
});

Then('stderr should contain {string}', function (expectedError) {
  expect(
    context.commandError,
    `stderr should contain "${expectedError}"`
  ).to.include(expectedError);
});

Then(
  'the command should fail with exit code {int}',
  function (expectedCode) {
    expect(context.exitCode, 'Exit code should match').to.equal(expectedCode);
  }
);

Then('the generation should complete successfully', function () {
  expect(context.exitCode, 'Command should succeed').to.equal(0);
  expect(context.commandError, 'Should have no errors').to.be.null;
});

// Then Steps - Performance Assertions
Then(
  'the generation should complete in less than {int} seconds',
  function (maxSeconds) {
    const maxMs = maxSeconds * 1000;
    expect(
      context.executionTime,
      `Generation should take less than ${maxSeconds}s`
    ).to.be.lessThan(maxMs);
  }
);

Then('memory usage should be less than {int}MB', function (maxMB) {
  const maxBytes = maxMB * 1024 * 1024;
  expect(
    context.memoryUsage,
    `Memory usage should be less than ${maxMB}MB`
  ).to.be.lessThan(maxBytes);
});

// Then Steps - Custom Code Preservation
Then('file {string} should preserve custom methods', async function (file) {
  const filePath = path.join('./generated/incremental-project', file);
  const content = await fs.readFile(filePath, 'utf-8');

  for (const block of context.customCodeBlocks) {
    if (block.file === path.basename(file)) {
      expect(content, 'Custom code block should be preserved').to.include(
        block.content
      );
    }
  }
});

Then(
  'stdout should contain {string}',
  function (expectedMessage) {
    expect(context.commandOutput).to.include(expectedMessage);
  }
);

// Helper Functions
function parseRDFFile(filePath) {
  return new Promise((resolve, reject) => {
    const parser = new N3.Parser();
    const store = new N3.Store();

    fs.readFile(filePath, 'utf-8')
      .then((data) => {
        parser.parse(data, (error, quad, prefixes) => {
          if (error) {
            reject(error);
          } else if (quad) {
            store.addQuad(quad);
          } else {
            // Parsing complete
            resolve({ store, prefixes });
          }
        });
      })
      .catch(reject);
  });
}

function extractClassesFromStore(store) {
  const classes = [];
  const classQuads = store.getQuads(
    null,
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    'http://www.w3.org/2000/01/rdf-schema#Class'
  );

  for (const quad of classQuads) {
    classes.push({
      uri: quad.subject.value,
      label: extractLabel(store, quad.subject),
      properties: extractProperties(store, quad.subject),
    });
  }

  return classes;
}

function extractLabel(store, subject) {
  const labelQuad = store.getQuads(
    subject,
    'http://www.w3.org/2000/01/rdf-schema#label',
    null
  )[0];
  return labelQuad ? labelQuad.object.value : subject.value.split('/').pop();
}

function extractProperties(store, classSubject) {
  const properties = [];
  const propertyQuads = store.getQuads(
    null,
    'http://www.w3.org/2000/01/rdf-schema#domain',
    classSubject
  );

  for (const quad of propertyQuads) {
    properties.push({
      uri: quad.subject.value,
      label: extractLabel(store, quad.subject),
      range: extractRange(store, quad.subject),
    });
  }

  return properties;
}

function extractRange(store, property) {
  const rangeQuad = store.getQuads(
    property,
    'http://www.w3.org/2000/01/rdf-schema#range',
    null
  )[0];
  return rangeQuad ? rangeQuad.object.value : 'xsd:string';
}

export {
  context,
  mockRDFParser,
  mockFileSystem,
  mockTemplateEngine,
  parseRDFFile,
  extractClassesFromStore,
};
