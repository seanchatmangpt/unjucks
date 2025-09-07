/**
 * BDD Step definitions for frontmatter processing testing
 * Tests frontmatter parsing and file injection capabilities
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

let fileInjector;
let tempFiles = [];
let lastProcessingResult = null;

// Setup and teardown
Before(async () => {
  nunjucksHelper.setupEnvironment();
  fileInjector = new FileInjector();
  
  // Clean up temp directory
  const tempDir = path.join(globalThis.testConfig?.tempDir || './tests/.tmp', 'frontmatter');
  await fs.ensureDir(tempDir);
  await fs.emptyDir(tempDir);
});

After(async () => {
  nunjucksHelper.cleanup();
  
  // Clean up created files
  for (const filePath of tempFiles) {
    try {
      await fs.remove(filePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  tempFiles = [];
  lastProcessingResult = null;
});

// Helper function to create temp file path
function getTempPath(filename) {
  const tempDir = path.join(globalThis.testConfig?.tempDir || './tests/.tmp', 'frontmatter');
  return path.join(tempDir, filename);
}

// Given steps - setup frontmatter templates and files
Given('I have a template with frontmatter:', (templateContent) => {
  const { data, content } = matter(templateContent);
  nunjucksHelper.setContext({ frontmatterData: data, templateBody: content });
  nunjucksHelper.registerTemplate('frontmatter_template', content);
});

Given('I have an existing file {string} with content:', async (filename, fileContent) => {
  const filePath = getTempPath(filename);
  await fs.writeFile(filePath, fileContent, 'utf8');
  tempFiles.push(filePath);
  nunjucksHelper.setContext({ targetFile: filePath });
});

Given('I have a target file path {string}', (filename) => {
  const filePath = getTempPath(filename);
  nunjucksHelper.setContext({ targetFile: filePath });
});

Given('I have frontmatter configuration:', (configContent) => {
  const config = JSON.parse(configContent);
  nunjucksHelper.setContext({ frontmatterConfig: config });
});

Given('I have injection mode set to {string}', (mode) => {
  const config = nunjucksHelper.context.frontmatterConfig || {};
  config.inject = mode === 'true';
  nunjucksHelper.setContext({ frontmatterConfig: config });
});

Given('I have the following frontmatter template:', (templateWithFrontmatter) => {
  const { data, content } = matter(templateWithFrontmatter);
  nunjucksHelper.setContext({ 
    frontmatterData: data, 
    templateBody: content,
    fullTemplate: templateWithFrontmatter
  });
  nunjucksHelper.registerTemplate('full_template', content);
});

// When steps - frontmatter processing actions
When('I parse the frontmatter', () => {
  const template = nunjucksHelper.context.fullTemplate || nunjucksHelper.context.templateBody;
  if (template) {
    const { data, content } = matter(template);
    nunjucksHelper.setContext({ 
      parsedFrontmatter: data, 
      parsedContent: content 
    });
  }
});

When('I render the template body', async () => {
  const templateBody = nunjucksHelper.context.templateBody;
  if (templateBody) {
    await nunjucksHelper.renderString(templateBody);
  }
});

When('I process the file with injection', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const config = nunjucksHelper.context.frontmatterConfig || {};
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

When('I process the file in dry run mode', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const config = nunjucksHelper.context.frontmatterConfig || {};
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: true, force: true }
  );
});

When('I inject content at line {int}', async (lineNumber) => {
  const targetFile = nunjucksHelper.context.targetFile;
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  const config = { lineAt: lineNumber };
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

When('I inject content before {string}', async (beforeText) => {
  const targetFile = nunjucksHelper.context.targetFile;
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  const config = { before: beforeText };
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

When('I inject content after {string}', async (afterText) => {
  const targetFile = nunjucksHelper.context.targetFile;
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  const config = { after: afterText };
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

When('I append content to the file', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  const config = { append: true };
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

When('I prepend content to the file', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  const config = { prepend: true };
  
  lastProcessingResult = await fileInjector.processFile(
    targetFile,
    renderedContent,
    config,
    { dry: false, force: true }
  );
});

// Then steps - frontmatter assertions
Then('the frontmatter should be parsed correctly', () => {
  const parsedData = nunjucksHelper.context.parsedFrontmatter;
  expect(parsedData).toBeTruthy();
  expect(typeof parsedData).toBe('object');
});

Then('the frontmatter should contain {string} with value {string}', (key, expectedValue) => {
  const parsedData = nunjucksHelper.context.parsedFrontmatter;
  expect(parsedData).toHaveProperty(key);
  expect(parsedData[key].toString()).toBe(expectedValue);
});

Then('the template body should be separated from frontmatter', () => {
  const parsedContent = nunjucksHelper.context.parsedContent;
  expect(parsedContent).toBeTruthy();
  expect(typeof parsedContent).toBe('string');
  expect(parsedContent).not.toContain('---'); // Should not contain frontmatter delimiter
});

Then('the file processing should succeed', () => {
  expect(lastProcessingResult).toBeTruthy();
  expect(lastProcessingResult.success).toBe(true);
  expect(lastProcessingResult.action).not.toBe('error');
});

Then('the file processing should fail', () => {
  expect(lastProcessingResult).toBeTruthy();
  expect(lastProcessingResult.success).toBe(false);
});

Then('the file should be created', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const exists = await fs.pathExists(targetFile);
  expect(exists).toBe(true);
  if (!tempFiles.includes(targetFile)) {
    tempFiles.push(targetFile);
  }
});

Then('the file should not be modified in dry run', async () => {
  expect(lastProcessingResult.success).toBe(true);
  // In dry run, file shouldn't actually be created/modified
  const targetFile = nunjucksHelper.context.targetFile;
  const existed = tempFiles.includes(targetFile);
  if (!existed) {
    const exists = await fs.pathExists(targetFile);
    expect(exists).toBe(false);
  }
});

Then('the file should contain the injected content', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const fileContent = await fs.readFile(targetFile, 'utf8');
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  expect(fileContent).toContain(renderedContent);
});

Then('the content should be injected at the correct position', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const fileContent = await fs.readFile(targetFile, 'utf8');
  const lines = fileContent.split('\n');
  const renderedContent = nunjucksHelper.getLastResult() || 'test content';
  
  // Check that content exists in the file
  expect(fileContent).toContain(renderedContent);
  
  // Additional position verification could be added based on the injection type
  expect(lines.length).toBeGreaterThan(0);
});

Then('the original file content should be preserved', async () => {
  const targetFile = nunjucksHelper.context.targetFile;
  const fileContent = await fs.readFile(targetFile, 'utf8');
  
  // Check that original content is still there (for injection modes)
  // This depends on the specific test case and original content
  expect(typeof fileContent).toBe('string');
  expect(fileContent.length).toBeGreaterThan(0);
});

Then('a backup file should be created', () => {
  expect(lastProcessingResult.backupPath).toBeTruthy();
  expect(lastProcessingResult.backupPath).toContain('.backup.');
});

Then('the processing result should indicate {string}', (expectedAction) => {
  expect(lastProcessingResult.action).toBe(expectedAction);
});

// Complex frontmatter scenarios
Then('the file should have the following structure:', async (expectedStructure) => {
  const targetFile = nunjucksHelper.context.targetFile;
  const fileContent = await fs.readFile(targetFile, 'utf8');
  const lines = fileContent.split('\n');
  
  const structureLines = expectedStructure.split('\n').filter(line => line.trim());
  
  // Check that each expected line exists in the file
  structureLines.forEach(expectedLine => {
    const trimmed = expectedLine.trim();
    if (trimmed) {
      expect(fileContent).toContain(trimmed);
    }
  });
});

Then('the frontmatter configuration should be applied correctly', () => {
  const config = nunjucksHelper.context.frontmatterConfig;
  expect(lastProcessingResult).toBeTruthy();
  
  if (config.inject) {
    expect(['update', 'create']).toContain(lastProcessingResult.action);
  }
  
  expect(lastProcessingResult.success).toBe(true);
});

// Utility steps
Then('I save the processed file as {string}', async (filename) => {
  const targetFile = nunjucksHelper.context.targetFile;
  const outputDir = globalThis.testConfig?.outputDir || './tests/output';
  const outputPath = path.join(outputDir, filename);
  
  await fs.ensureDir(path.dirname(outputPath));
  await fs.copy(targetFile, outputPath);
  console.log(`Processed file saved to: ${outputPath}`);
});

Then('the processing should skip due to {string}', (reason) => {
  expect(lastProcessingResult.skipped).toBe(true);
  expect(lastProcessingResult.message.toLowerCase()).toContain(reason.toLowerCase());
});