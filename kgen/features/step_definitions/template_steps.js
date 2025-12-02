/**
 * Template Rendering Step Definitions for KGEN Templates
 * Implements comprehensive testing for Nunjucks template rendering with RDF integration
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import path from 'path';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';
import { TemplateRenderer } from '../../packages/kgen-templates/src/renderer.js';
import matter from 'gray-matter';

/**
 * Template test state interface
 * @typedef {Object} TemplateTestState
 * @property {KgenTemplateEngine} engine - Template engine instance
 * @property {TemplateRenderer} renderer - Template renderer instance
 * @property {string} templateContent - Current template content
 * @property {Record<string, any>} templateVariables - Template variables
 * @property {Record<string, any>} globalContext - Global context variables
 * @property {string} renderedOutput - Rendered output content
 * @property {string} templatePath - Template file path
 * @property {string} baseTemplate - Base template path
 * @property {string} childTemplate - Child template path
 * @property {Record<string, string>} partialTemplates - Partial template paths
 * @property {string} macroTemplate - Macro template path
 * @property {Record<string, any>} frontmatter - Frontmatter data
 * @property {Error | null} renderingError - Rendering error if any
 * @property {Record<string, any>} nunjucksSettings - Nunjucks environment settings
 * @property {any} rdfData - RDF data for templates
 * @property {any} lastArtifact - Last generated artifact
 * @property {Record<string, string>} fixtures - Test fixture file paths
 */

// Test state management
/** @type {TemplateTestState} */
const testState = {
  engine: null,
  renderer: null,
  templateContent: '',
  templateVariables: {},
  globalContext: {},
  renderedOutput: '',
  templatePath: '',
  baseTemplate: '',
  childTemplate: '',
  partialTemplates: {},
  macroTemplate: '',
  frontmatter: {},
  renderingError: null,
  nunjucksSettings: {},
  rdfData: null,
  lastArtifact: null,
  fixtures: {}
};

// Helper functions
const fixturesDir = path.join(__dirname, '../fixtures/templates');

/**
 * Ensures the fixtures directory exists
 * @returns {Promise<void>}
 */
async function ensureFixturesDirectory() {
  try {
    await fs.access(fixturesDir);
  } catch {
    await fs.mkdir(fixturesDir, { recursive: true });
  }
}

/**
 * Writes a template fixture file
 * @param {string} filename - Filename for the fixture
 * @param {string} content - Template content
 * @returns {Promise<string>} - Full file path
 */
async function writeTemplateFixture(filename, content) {
  await ensureFixturesDirectory();
  const filePath = path.join(fixturesDir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  testState.fixtures[filename] = filePath;
  return filePath;
}

/**
 * Parses variables string as JSON with fallback
 * @param {string} variablesStr - Variables string to parse
 * @returns {Record<string, any>} - Parsed variables object
 */
function parseVariablesString(variablesStr) {
  try {
    return JSON.parse(variablesStr);
  } catch {
    return {};
  }
}

// Background steps
Given('the Nunjucks template system is initialized', async function() {
  testState.engine = new KgenTemplateEngine({
    templateDirs: [fixturesDir, path.join(__dirname, '../../_templates')],
    outputDir: path.join(__dirname, '../output'),
    deterministic: true
  });
  
  testState.renderer = new TemplateRenderer({
    enableCache: false,
    enableRDF: true,
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true,
    debug: true
  });
  
  expect(testState.engine).to.not.be.null;
  expect(testState.renderer).to.not.be.null;
});

Given('template variables are available', function() {
  testState.templateVariables = {
    name: 'World',
    className: 'TestClass',
    user: {
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      }
    }
  };
});

// Template content steps
Given('a template with content {string}', function(content) {
  testState.templateContent = content;
});

Given('a template with content:', function(docString) {
  testState.templateContent = docString;
});

Given('variables {string}', function(variablesJson) {
  testState.templateVariables = parseVariablesString(variablesJson);
});

Given('variables:', function(docString) {
  testState.templateVariables = parseVariablesString(docString);
});

Given('user variables {string}', function(variablesJson) {
  const userVars = parseVariablesString(variablesJson);
  testState.templateVariables = { ...testState.templateVariables, ...userVars };
});

Given('global context variables:', function(docString) {
  testState.globalContext = parseVariablesString(docString);
});

// Template inheritance steps
Given('a base template {string}:', async function(templateName, docString) {
  const templatePath = await writeTemplateFixture(templateName, docString);
  testState.baseTemplate = templatePath;
});

Given('a child template extending base:', async function(docString) {
  const templatePath = await writeTemplateFixture('child.njk', docString);
  testState.childTemplate = templatePath;
});

// Partial template steps
Given('a partial template {string}:', async function(templateName, docString) {
  const templatePath = await writeTemplateFixture(templateName, docString);
  testState.partialTemplates[templateName] = templatePath;
});

Given('a main template:', async function(docString) {
  const templatePath = await writeTemplateFixture('main.njk', docString);
  testState.templatePath = templatePath;
});

// Macro template steps
Given('a template with macros:', async function(docString) {
  const templatePath = await writeTemplateFixture('macros.njk', docString);
  testState.macroTemplate = templatePath;
  testState.templateContent = docString;
});

// Frontmatter steps
Given('a template with frontmatter:', async function(docString) {
  const { data, content } = matter(docString);
  testState.frontmatter = data;
  testState.templateContent = content;
  
  const fullTemplate = `---\n${matter.stringify('', data).split('---\n')[1]}---\n${content}`;
  const templatePath = await writeTemplateFixture('frontmatter.njk', fullTemplate);
  testState.templatePath = templatePath;
});

// Invalid syntax steps
Given('a template with invalid syntax:', async function(docString) {
  testState.templateContent = docString;
});

// Nunjucks environment settings
Given('custom Nunjucks environment with:', function(dataTable) {
  const settings = {};
  for (const row of dataTable.hashes()) {
    const value = row.Value === 'true' ? true : row.Value === 'false' ? false : row.Value;
    settings[row.Setting] = value;
  }
  testState.nunjucksSettings = settings;
  
  // Reinitialize engine with custom settings
  testState.engine = new KgenTemplateEngine({
    templateDirs: [fixturesDir],
    outputDir: path.join(__dirname, '../output'),
    deterministic: true,
    ...settings
  });
});

Given('a template with HTML content and undefined variables', function() {
  testState.templateContent = '<p>Hello {{ undefinedVar }}!</p><script>{{ anotherUndefined }}</script>';
});

Given('variables containing special characters:', function(docString) {
  testState.templateVariables = parseVariablesString(docString);
});

Given('a template with specific indentation:', function(docString) {
  testState.templateContent = docString;
});

// RDF-related steps
Given('RDF data is available', function() {
  testState.rdfData = {
    prefixes: {
      foaf: 'http://xmlns.com/foaf/0.1/',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
    },
    triples: [
      { subject: 'ex:person1', predicate: 'foaf:name', object: '"John Doe"' },
      { subject: 'ex:person1', predicate: 'foaf:email', object: '"john@example.com"' }
    ]
  };
});

// Rendering steps
When('I render the template', async function() {
  try {
    testState.renderingError = null;
    
    if (testState.templatePath) {
      // Render from file
      const result = await testState.engine.render(testState.templatePath, {
        ...testState.globalContext,
        ...testState.templateVariables
      });
      testState.renderedOutput = result.content;
      testState.lastArtifact = result;
    } else {
      // Render from string content
      const rendered = testState.engine.env.renderString(testState.templateContent, {
        ...testState.globalContext,
        ...testState.templateVariables
      });
      testState.renderedOutput = rendered;
    }
  } catch (error) {
    testState.renderingError = error;
    testState.renderedOutput = '';
  }
});

When('I render the child template with variables {string}', async function(variablesJson) {
  try {
    const variables = parseVariablesString(variablesJson);
    const result = await testState.engine.render(testState.childTemplate, variables);
    testState.renderedOutput = result.content;
  } catch (error) {
    testState.renderingError = error;
  }
});

When('I render the main template', async function() {
  try {
    const result = await testState.engine.render(testState.templatePath, {
      ...testState.globalContext,
      ...testState.templateVariables
    });
    testState.renderedOutput = result.content;
  } catch (error) {
    testState.renderingError = error;
  }
});

When('I render the template including frontmatter', async function() {
  try {
    const result = await testState.engine.render(testState.templatePath, testState.templateVariables);
    testState.renderedOutput = result.content;
    testState.lastArtifact = result;
  } catch (error) {
    testState.renderingError = error;
  }
});

When('I attempt to render the template', async function() {
  try {
    testState.renderingError = null;
    const rendered = testState.engine.env.renderString(testState.templateContent, testState.templateVariables);
    testState.renderedOutput = rendered;
  } catch (error) {
    testState.renderingError = error;
    testState.renderedOutput = '';
  }
});

// Assertion steps
Then('the output should be {string}', function(expectedOutput) {
  expect(testState.renderedOutput.trim()).to.equal(expectedOutput);
});

Then('the output should contain {string}', function(expectedContent) {
  expect(testState.renderedOutput).to.contain(expectedContent);
});

Then('the output should contain:', function(docString) {
  const expectedLines = docString.trim().split('\n');
  for (const line of expectedLines) {
    if (line.trim()) {
      expect(testState.renderedOutput).to.contain(line.trim());
    }
  }
});

Then('the output should not contain {string}', function(unexpectedContent) {
  expect(testState.renderedOutput).to.not.contain(unexpectedContent);
});

Then('undefined variables should render as empty strings', function() {
  // Check that undefined variables don't cause errors and render as empty
  expect(testState.renderedOutput).to.not.contain('undefined');
  expect(testState.renderedOutput).to.not.contain('null');
});

Then('no errors should be thrown', function() {
  expect(testState.renderingError).to.be.null;
});

Then('the output should contain properly nested structure', function() {
  expect(testState.renderedOutput).to.contain('export class UserService');
  expect(testState.renderedOutput).to.contain('getUser(): User');
  expect(testState.renderedOutput).to.contain('deleteUser(): void');
});

Then('method implementations should be rendered correctly', function() {
  expect(testState.renderedOutput).to.contain('return this.db.findUser();');
  expect(testState.renderedOutput).to.contain('throw new Error(\'Not implemented\');');
});

Then('the output should contain the header comment', function() {
  expect(testState.renderedOutput).to.contain('/**');
  expect(testState.renderedOutput).to.contain('User service class');
  expect(testState.renderedOutput).to.contain('@author John Doe');
  expect(testState.renderedOutput).to.contain('*/');
});

Then('the output should contain properly formatted methods', function() {
  expect(testState.renderedOutput).to.match(/getUser\([^)]*\): User \{\}/);
  expect(testState.renderedOutput).to.match(/deleteUser\([^)]*\): void \{\}/);
});

Then('macro calls should be expanded correctly', function() {
  expect(testState.renderedOutput).to.contain('getUser(id: string): User {}');
  expect(testState.renderedOutput).to.contain('deleteUser(id: string): void {}');
});

Then('the output should contain project and generator information', function() {
  expect(testState.renderedOutput).to.contain('Generated by component v2.1.0');
  expect(testState.renderedOutput).to.contain('For project: MyApp v1.0.0');
});

Then('user variables should also be available', function() {
  expect(testState.renderedOutput).to.contain('export class Button');
});

Then('specific syntax errors should be reported', function() {
  expect(testState.renderingError).to.not.be.null;
  expect(testState.renderingError.message).to.contain('syntax');
});

Then('error messages should include line numbers', function() {
  expect(testState.renderingError).to.not.be.null;
  expect(testState.renderingError.message).to.match(/line \d+/i);
});

Then('rendering should fail with clear error descriptions', function() {
  expect(testState.renderingError).to.not.be.null;
  expect(testState.renderingError.message.length).to.be.greaterThan(10);
});

Then('the {string} path should be {string}', function(pathType, expectedPath) {
  if (pathType === 'to') {
    expect(testState.lastArtifact?.outputPath).to.contain(expectedPath);
  }
});

Then('the content should be {string}', function(expectedContent) {
  expect(testState.renderedOutput.trim()).to.equal(expectedContent);
});

Then('original indentation should be preserved', function() {
  const lines = testState.renderedOutput.split('\n');
  const indentedLines = lines.filter(line => line.startsWith('    ') || line.startsWith('        '));
  expect(indentedLines.length).to.be.greaterThan(0);
});

Then('generated code should maintain proper formatting', function() {
  expect(testState.renderedOutput).to.not.match(/\s{2,}\n/); // No excessive trailing whitespace
  expect(testState.renderedOutput).to.match(/{\s*\n/); // Proper brace formatting
});

Then('conditional blocks should not introduce extra whitespace', function() {
  expect(testState.renderedOutput).to.not.match(/\n\s*\n\s*\n/); // No triple line breaks
});

Then('special characters should be preserved', function() {
  expect(testState.renderedOutput).to.contain('"');
  expect(testState.renderedOutput).to.contain('&');
  expect(testState.renderedOutput).to.contain('<');
  expect(testState.renderedOutput).to.contain('>');
  expect(testState.renderedOutput).to.contain("'");
});

Then('no HTML escaping should occur by default', function() {
  expect(testState.renderedOutput).to.not.contain('&quot;');
  expect(testState.renderedOutput).to.not.contain('&amp;');
  expect(testState.renderedOutput).to.not.contain('&lt;');
  expect(testState.renderedOutput).to.not.contain('&gt;');
});

Then('output should contain original special characters', function() {
  expect(testState.renderedOutput).to.contain('Hello "World" & <Universe> with \'quotes\'');
});

Then('HTML should not be escaped', function() {
  expect(testState.renderedOutput).to.contain('<p>');
  expect(testState.renderedOutput).to.contain('<script>');
  expect(testState.renderedOutput).to.not.contain('&lt;');
  expect(testState.renderedOutput).to.not.contain('&gt;');
});

Then('block whitespace should be trimmed', function() {
  const lines = testState.renderedOutput.split('\n');
  const emptyLines = lines.filter(line => line.trim() === '');
  expect(emptyLines.length).to.be.lessThan(3); // Minimal empty lines due to trimming
});

Then('undefined variables should not throw errors', function() {
  expect(testState.renderingError).to.be.null;
});

// Filter-specific steps
Then('the output should be filtered with {string}', function(filterName) {
  switch (filterName) {
    case 'upperFirst':
      expect(testState.renderedOutput).to.contain('UserProfile');
      break;
    case 'kebabCase':
      expect(testState.renderedOutput).to.contain('user-profile');
      break;
    case 'pascalCase':
      expect(testState.renderedOutput).to.contain('UserProfile');
      break;
    case 'camelCase':
      expect(testState.renderedOutput).to.contain('userProfile');
      break;
    default:
      throw new Error(`Unknown filter: ${filterName}`);
  }
});

// Cleanup steps
Before(function() {
  // Reset state before each scenario
  Object.keys(testState).forEach(key => {
    if (typeof testState[key] === 'object' && testState[key] !== null) {
      if (Array.isArray(testState[key])) {
        testState[key] = [];
      } else {
        testState[key] = {};
      }
    } else {
      testState[key] = null;
    }
  });
});

After(async function() {
  // Cleanup fixtures after each scenario
  try {
    for (const [filename, filePath] of Object.entries(testState.fixtures)) {
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    testState.fixtures = {};
  } catch {
    // Ignore cleanup errors
  }
});

// Export for testing purposes
export { testState, parseVariablesString, writeTemplateFixture };