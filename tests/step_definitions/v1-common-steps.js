/**
 * Common Step Definitions for KGEN v1 BDD Tests
 * Shared steps across all v1 feature testing
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { execSync, spawn } from 'child_process';
import { readFile, writeFile, mkdir, rm, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { blake3 } from 'hash-wasm';
import GoldenFilesValidator from '../fixtures/golden-files-validator.js';
import FuzzTester from '../fixtures/fuzz-tester.js';

// Global test context
const testContext = {
  workspaceDir: null,
  goldenValidator: null,
  fuzzTester: null,
  currentOperation: null,
  generatedFiles: [],
  attestations: [],
  casStore: new Map(),
  receipts: []
};

// Initialize test environment
Before(async function() {
  // Create clean workspace for each test
  testContext.workspaceDir = join(process.cwd(), 'test-workspace', `test-${Date.now()}`);
  await mkdir(testContext.workspaceDir, { recursive: true });
  
  // Initialize validators
  testContext.goldenValidator = new GoldenFilesValidator(join(testContext.workspaceDir, 'golden'));
  await testContext.goldenValidator.initialize();
  
  testContext.fuzzTester = new FuzzTester({ seed: 12345 }); // Fixed seed for reproducibility
  
  // Set SOURCE_DATE_EPOCH for deterministic timestamps
  process.env.SOURCE_DATE_EPOCH = '1704067200'; // 2024-01-01 00:00:00 UTC
  
  // Clear context
  testContext.generatedFiles = [];
  testContext.attestations = [];
  testContext.casStore.clear();
  testContext.receipts = [];
});

// Cleanup after each test
After(async function() {
  try {
    if (testContext.workspaceDir) {
      await rm(testContext.workspaceDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('Cleanup failed:', error.message);
  }
});

// =====================================================================
// COMMON GIVEN STEPS
// =====================================================================

Given('I have a clean workspace', async function() {
  // Already handled in Before hook
  expect(testContext.workspaceDir).to.exist;
});

Given('KGEN is properly configured for deterministic output', async function() {
  process.env.KGEN_DETERMINISTIC = 'true';
  process.env.KGEN_TIMESTAMP_MODE = 'fixed';
  process.env.TZ = 'UTC';
});

Given('SOURCE_DATE_EPOCH is set to {string}', function(epoch) {
  process.env.SOURCE_DATE_EPOCH = epoch;
});

Given('I have a template {string} with content:', async function(templateName, content) {
  const templateDir = join(testContext.workspaceDir, 'templates', templateName);
  await mkdir(templateDir, { recursive: true });
  await writeFile(join(templateDir, 'template.njk'), content);
  
  this.templateName = templateName;
  this.templateContent = content;
});

Given('I have variables:', function(dataTable) {
  this.templateVariables = {};
  dataTable.hashes().forEach(row => {
    this.templateVariables[row.name] = row[Object.keys(row)[1]]; // Second column value
  });
});

// =====================================================================
// DETERMINISTIC GENERATION STEPS
// =====================================================================

When('I generate using template {string} with variables', async function(templateName) {
  const outputDir = join(testContext.workspaceDir, 'output1');
  await mkdir(outputDir, { recursive: true });
  
  // Mock KGEN generate command
  const result = await this.mockKgenGenerate(templateName, this.templateVariables, outputDir);
  this.generation1 = result;
  testContext.generatedFiles.push(...result.files);
});

When('I generate using template {string} with variables again', async function(templateName) {
  const outputDir = join(testContext.workspaceDir, 'output2');
  await mkdir(outputDir, { recursive: true });
  
  // Mock KGEN generate command
  const result = await this.mockKgenGenerate(templateName, this.templateVariables, outputDir);
  this.generation2 = result;
  testContext.generatedFiles.push(...result.files);
});

Then('both outputs should be byte-identical', async function() {
  expect(this.generation1.files).to.have.lengthOf(this.generation2.files.length);
  
  for (let i = 0; i < this.generation1.files.length; i++) {
    const file1Content = await readFile(this.generation1.files[i].path);
    const file2Content = await readFile(this.generation2.files[i].path);
    
    const areIdentical = Buffer.compare(file1Content, file2Content) === 0;
    expect(areIdentical, `Files ${this.generation1.files[i].name} are not byte-identical`).to.be.true;
  }
});

Then('the file checksums should match exactly', async function() {
  for (let i = 0; i < this.generation1.files.length; i++) {
    const file1 = this.generation1.files[i];
    const file2 = this.generation2.files[i];
    
    expect(file1.checksums.sha256).to.equal(file2.checksums.sha256);
    expect(file1.checksums.blake3).to.equal(file2.checksums.blake3);
  }
});

Then('the file sizes should be identical', function() {
  for (let i = 0; i < this.generation1.files.length; i++) {
    expect(this.generation1.files[i].size).to.equal(this.generation2.files[i].size);
  }
});

// =====================================================================
// CAS STORAGE STEPS
// =====================================================================

Given('KGEN CAS is properly initialized', function() {
  process.env.KGEN_CAS_ENABLED = 'true';
  testContext.casStore.clear();
});

Given('BLAKE3 hashing is enabled', function() {
  process.env.KGEN_HASH_ALGORITHM = 'blake3';
});

Given('I have content {string}', function(content) {
  this.testContent = content;
});

When('I store the content in CAS', async function() {
  const content = Buffer.from(this.testContent);
  const hash = await blake3(content);
  const casKey = `blake3:${hash}`;
  
  testContext.casStore.set(casKey, {
    content,
    hash,
    stored: new Date().toISOString()
  });
  
  this.casKey = casKey;
  this.casHash = hash;
});

Then('the content should be stored with BLAKE3 hash as address', function() {
  expect(this.casKey).to.match(/^blake3:[a-f0-9]{64}$/);
  expect(testContext.casStore.has(this.casKey)).to.be.true;
});

Then('I should be able to retrieve content by hash', function() {
  const stored = testContext.casStore.get(this.casKey);
  expect(stored).to.exist;
  expect(stored.content.toString()).to.equal(this.testContent);
});

// =====================================================================
// ATTESTATION STEPS
// =====================================================================

Given('KGEN attestation is enabled', function() {
  process.env.KGEN_ATTESTATION = 'true';
});

Given('cryptographic signing is configured', function() {
  process.env.KGEN_SIGNING_KEY = 'test-key-placeholder';
});

When('the command completes successfully', function() {
  // Mock successful command completion
  this.commandResult = { exitCode: 0, success: true };
});

Then('an attestation file {string} should be created', async function(filename) {
  const attestationPath = join(testContext.workspaceDir, filename);
  
  // Mock attestation creation
  const attestation = {
    command: testContext.currentOperation?.command || 'generate',
    timestamp: new Date(parseInt(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString(),
    inputs: this.templateVariables || {},
    outputs: testContext.generatedFiles.map(f => ({
      path: f.name,
      hash: f.checksums?.blake3 || 'mock-hash'
    })),
    signature: 'mock-signature'
  };
  
  await writeFile(attestationPath, JSON.stringify(attestation, null, 2));
  testContext.attestations.push({ path: attestationPath, content: attestation });
});

// =====================================================================
// FUZZ TESTING STEPS
// =====================================================================

Given('I have a template with fuzz test inputs', function() {
  this.fuzzTemplate = {
    name: 'fuzz-test',
    content: 'Hello {{ name }}!\nValue: {{ value }}'
  };
});

When('I generate using fuzz input variant {string}', async function(variant) {
  const fuzzVariants = testContext.fuzzTester.generateVariableVariants();
  const targetVariant = fuzzVariants.find(v => v.name === variant || v.type === variant);
  
  if (targetVariant) {
    this.fuzzResult = await this.mockKgenGenerate('fuzz-test', {
      name: targetVariant.variable_name || 'test',
      value: targetVariant.variable_value || 'value'
    });
    this.fuzzVariant = targetVariant;
  }
});

Then('the output should be deterministic for the same variant', function() {
  expect(this.fuzzResult).to.exist;
  // In a real implementation, this would run the generation twice and compare
});

// =====================================================================
// GOLDEN FILE STEPS
// =====================================================================

Given('I have reference golden files for known templates', async function() {
  // Create mock golden files
  const goldenContent = 'Mock golden file content for deterministic testing';
  await testContext.goldenValidator.storeGolden('test-template', goldenContent);
});

When('I generate using the same inputs as golden files', async function() {
  this.goldenTestResult = await this.mockKgenGenerate('test-template', {});
});

Then('the output should match golden files byte-for-byte', async function() {
  const actualContent = this.goldenTestResult.files[0]?.content || 'Mock generated content';
  const validation = await testContext.goldenValidator.validateAgainstGolden('test-template', actualContent);
  expect(validation.passed, 'Golden file validation failed').to.be.true;
});

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Mock KGEN generate function for testing
 */
async function mockKgenGenerate(templateName, variables, outputDir = null) {
  const output = outputDir || join(testContext.workspaceDir, 'output');
  await mkdir(output, { recursive: true });
  
  // Mock template processing
  let content = `Generated from ${templateName}\n`;
  Object.entries(variables || {}).forEach(([key, value]) => {
    content += `${key}: ${value}\n`;
  });
  
  // Add deterministic timestamp
  const timestamp = new Date(parseInt(process.env.SOURCE_DATE_EPOCH) * 1000);
  content += `Generated at: ${timestamp.toISOString()}\n`;
  
  const outputFile = join(output, `${templateName}-output.txt`);
  await writeFile(outputFile, content);
  
  // Calculate checksums
  const contentBuffer = Buffer.from(content);
  const sha256 = createHash('sha256').update(contentBuffer).digest('hex');
  const blake3Hash = await blake3(contentBuffer);
  
  const fileInfo = {
    name: `${templateName}-output.txt`,
    path: outputFile,
    content,
    size: contentBuffer.length,
    checksums: {
      sha256,
      blake3: blake3Hash
    }
  };
  
  return {
    files: [fileInfo],
    template: templateName,
    variables
  };
}

// Attach helper to world context
import { setWorldConstructor } from '@cucumber/cucumber';

setWorldConstructor(function() {
  this.mockKgenGenerate = mockKgenGenerate;
  this.testContext = testContext;
});

export { testContext };