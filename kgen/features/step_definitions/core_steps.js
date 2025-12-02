/**
 * Improved Core BDD Step Definitions for Content-Addressed Storage (CAS) Engine
 * 
 * This version integrates the CAS engine with comprehensive helper utilities for:
 * - Deterministic template rendering validation
 * - Content addressing and integrity verification
 * - RDF graph variable extraction with proper parsing
 * - Advanced cache performance testing with KPI validation
 * - Performance benchmarking and metrics collection
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import the actual CAS engine from kgen-core
import { CASEngine } from '../../packages/kgen-core/src/cas/index.js';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';

// Import test helpers and utilities
import {
  PerformanceTracker,
  SimpleRDFParser,
  HashValidator,
  TestDataGenerator,
  FileSystemHelper,
  CacheTestHelper
} from '../fixtures/cas-test-helpers.js';

/**
 * Test context interface for comprehensive CAS testing
 * @typedef {Object} TestContext
 * @property {CASEngine} casEngine - Content-addressed storage engine
 * @property {KgenTemplateEngine} templateEngine - Template rendering engine
 * @property {string} testWorkspace - Test workspace directory
 * @property {Map<string, string>} templates - Template content mapping
 * @property {Map<string, string>} rdfGraphs - RDF graph content mapping
 * @property {Map<string, string>} generatedFiles - Generated file content mapping
 * @property {PerformanceTracker} performanceTracker - Performance tracking utility
 * @property {any} cacheMetrics - Cache performance metrics
 * @property {Map<string, string>} contentHashes - Content hash mapping
 * @property {Map<string, any>} testResults - Test result data
 * @property {string[]} deterministicHashes - Deterministic hash results
 */

// Global test context with improved initialization
/** @type {TestContext} */
let testContext = {
  casEngine: new CASEngine({ 
    storageType: 'memory', 
    cacheSize: 1000,
    enableMetrics: true,
    performanceTarget: { hashTimeP95: 5, cacheHitRate: 0.80 }
  }),
  templateEngine: new KgenTemplateEngine({ deterministic: true }),
  testWorkspace: '',
  templates: new Map(),
  rdfGraphs: new Map(),
  generatedFiles: new Map(),
  performanceTracker: new PerformanceTracker(),
  cacheMetrics: {},
  contentHashes: new Map(),
  testResults: new Map(),
  deterministicHashes: []
};

// =============================================================================
// Initialization and Cleanup Steps
// =============================================================================

Given('I have initialized the CAS engine', async function() {
  await testContext.casEngine.initialize();
  testContext.testWorkspace = await FileSystemHelper.createTempWorkspace('cas-test');
  
  // Clear previous test state
  testContext.templates.clear();
  testContext.rdfGraphs.clear();
  testContext.generatedFiles.clear();
  testContext.performanceTracker.clear();
  testContext.contentHashes.clear();
  testContext.testResults.clear();
  testContext.deterministicHashes = [];
  
  await testContext.casEngine.clear(true);
});

Given('I have a clean test workspace', async function() {
  await this.step('I have initialized the CAS engine');
});

// =============================================================================
// Content-Addressed Storage (CAS) Step Definitions
// =============================================================================

Given('I have content {string} with expected hash {string}', async function(content, expectedHash) {
  testContext.performanceTracker.start('cas-store');
  const actualHash = await testContext.casEngine.store(content);
  testContext.performanceTracker.end('cas-store');
  
  testContext.contentHashes.set(content, actualHash);
  
  if (expectedHash !== 'ANY') {
    expect(actualHash).to.equal(expectedHash, 'Content hash should match expected value');
  }
});

When('I store content {string} in CAS', async function(content) {
  testContext.performanceTracker.start('cas-store', { contentLength: content.length });
  const hash = await testContext.casEngine.store(content);
  testContext.performanceTracker.end('cas-store', { hash });
  
  testContext.contentHashes.set(content, hash);
});

When('I retrieve content by hash {string}', async function(hash) {
  testContext.performanceTracker.start('cas-retrieve');
  const content = await testContext.casEngine.retrieve(hash);
  testContext.performanceTracker.end('cas-retrieve', { found: content !== null });
  
  testContext.testResults.set(`retrieve_${hash}`, content);
});

Then('the content should be retrievable by its hash', async function() {
  for (const [originalContent, hash] of testContext.contentHashes.entries()) {
    const retrievedContent = await testContext.casEngine.retrieve(hash);
    expect(retrievedContent).to.not.be.null;
    
    if (retrievedContent) {
      const retrievedString = retrievedContent.toString();
      expect(retrievedString).to.equal(originalContent, `Content should match original for hash ${hash}`);
    }
  }
});

Then('the SHA-256 hash should be {string}', function(expectedHash) {
  const lastHash = Array.from(testContext.contentHashes.values()).pop();
  expect(lastHash).to.equal(expectedHash, 'SHA-256 hash should match expected value');
});

Then('content integrity should be verified', async function() {
  for (const [originalContent, hash] of testContext.contentHashes.entries()) {
    const isValid = testContext.casEngine.verify(hash, originalContent);
    expect(isValid).to.be.true, `Content integrity verification failed for hash ${hash}`);
    
    // Additional validation using HashValidator utility
    const expectedHash = HashValidator.sha256(originalContent);
    expect(hash).to.equal(expectedHash, `Hash should match HashValidator calculation`);
  }
});

// =============================================================================
// Deterministic Rendering Step Definitions  
// =============================================================================

Given('I have a deterministic template {string}:', function(templateName, templateContent) {
  testContext.templates.set(templateName, templateContent);
});

When('I render the template {string} with variables:', async function(templateName, variablesTable) {
  const template = testContext.templates.get(templateName);
  expect(template).to.not.be.undefined, `Template ${templateName} not found`);
  
  // Convert Cucumber table to variables object
  /** @type {any} */
  const variables = {};
  if (variablesTable && variablesTable.hashes) {
    variablesTable.hashes().forEach((row) => {
      // Handle JSON parsing for complex values
      try {
        variables[row.key] = JSON.parse(row.value);
      } catch {
        variables[row.key] = row.value;
      }
    });
  }
  
  testContext.performanceTracker.start('template-render', { templateName });
  const result = await testContext.templateEngine.render(template, variables);
  testContext.performanceTracker.end('template-render');
  
  testContext.generatedFiles.set(`${templateName}_output`, result.content);
  
  // Store in CAS for hash verification
  const hash = await testContext.casEngine.store(result.content);
  testContext.contentHashes.set(`${templateName}_render`, hash);
  testContext.deterministicHashes.push(hash);
});

When('I render the same template {int} times with identical variables', async function(iterations, templateName) {
  const template = testContext.templates.get(templateName);
  expect(template).to.not.be.undefined;
  
  const variables = { name: 'TestComponent', withProps: true };
  const hashes = [];
  
  for (let i = 0; i < iterations; i++) {
    testContext.performanceTracker.start(`deterministic-render-${i}`);
    const result = await testContext.templateEngine.render(template, variables);
    testContext.performanceTracker.end(`deterministic-render-${i}`);
    
    const hash = await testContext.casEngine.store(result.content);
    hashes.push(hash);
  }
  
  testContext.testResults.set('deterministic_hashes', hashes);
});

Then('all rendered outputs should have identical SHA-256 hashes', function() {
  const hashes = testContext.testResults.get('deterministic_hashes') || testContext.deterministicHashes;
  expect(hashes).to.be.an('array');
  expect(hashes.length).to.be.greaterThan(1);
  
  const validation = HashValidator.validateIdenticalHashes(hashes);
  expect(validation.allIdentical).to.be.true, 
    `Expected all hashes to be identical, but found ${validation.uniqueHashes.length} unique hashes: ${validation.uniqueHashes.join(', ')}`);
});

Then('the output should be byte-identical across renders', async function() {
  const hashes = testContext.testResults.get('deterministic_hashes') || testContext.deterministicHashes;
  expect(hashes).to.be.an('array');
  
  const firstHash = hashes[0];
  const firstContent = await testContext.casEngine.retrieve(firstHash);
  expect(firstContent).to.not.be.null;
  
  for (let i = 1; i < hashes.length; i++) {
    const otherContent = await testContext.casEngine.retrieve(hashes[i]);
    expect(otherContent).to.not.be.null;
    
    const comparison = HashValidator.compareContent(firstContent, otherContent);
    expect(comparison.identical).to.be.true, 
      `Byte content at iteration ${i} should match first iteration. Hash1: ${comparison.hash1}, Hash2: ${comparison.hash2}`);
  }
});

// =============================================================================
// RDF Graph Template Variable Extraction
// =============================================================================

Given('I have an RDF graph {string}:', function(graphName, rdfContent) {
  testContext.rdfGraphs.set(graphName, rdfContent);
});

When('I extract template variables from RDF graph {string}', async function(graphName) {
  const rdfContent = testContext.rdfGraphs.get(graphName);
  expect(rdfContent).to.not.be.undefined;
  
  // Use the improved RDF parser from helpers
  const triples = SimpleRDFParser.parseTriples(rdfContent);
  const variables = SimpleRDFParser.extractVariables(triples);
  
  testContext.testResults.set(`rdf_variables_${graphName}`, variables);
});

Then('I should extract variables:', function(expectedVariablesTable) {
  const lastGraphName = Array.from(testContext.rdfGraphs.keys()).pop();
  const extractedVariables = testContext.testResults.get(`rdf_variables_${lastGraphName}`);
  
  expect(extractedVariables).to.be.an('object');
  
  expectedVariablesTable.hashes().forEach((row) => {
    expect(extractedVariables[row.variable]).to.equal(row.value, 
      `Variable ${row.variable} should have value ${row.value}`);
  });
});

// =============================================================================
// Cache Performance Validation with Advanced Metrics
// =============================================================================

When('I perform {int} cache operations with {float} expected hit rate', async function(operations, expectedHitRate) {
  // Generate realistic cache access pattern
  const accessPattern = CacheTestHelper.generateAccessPattern(operations, expectedHitRate);
  
  testContext.performanceTracker.start('cache-performance-test');
  
  for (const operation of accessPattern) {
    if (operation.type === 'store') {
      await testContext.casEngine.store(operation.content);
    } else {
      await testContext.casEngine.retrieve(operation.key);
    }
  }
  
  testContext.performanceTracker.end('cache-performance-test');
  testContext.cacheMetrics = testContext.casEngine.getMetrics();
});

Then('the cache hit rate should be at least {float}%', function(minHitRate) {
  expect(testContext.cacheMetrics).to.have.property('cache');
  expect(testContext.cacheMetrics.cache).to.have.property('hitRate');
  
  const actualHitRate = testContext.cacheMetrics.cache.hitRate * 100;
  expect(actualHitRate).to.be.at.least(minHitRate, 
    `Cache hit rate ${actualHitRate}% should be at least ${minHitRate}%`);
});

Then('the cache performance should meet KPI targets', function() {
  const metrics = testContext.cacheMetrics;
  
  expect(metrics).to.have.property('performance');
  expect(metrics.performance).to.have.property('meetsTargets');
  
  expect(metrics.performance.meetsTargets.hitRate).to.be.true, 
    `Cache hit rate target not met: ${metrics.cache.hitRate * 100}%`);
  expect(metrics.performance.meetsTargets.hashTime).to.be.true,
    `Hash time target not met: ${metrics.performance.hashTimeP95}ms`);
});

// =============================================================================
// Performance Validation Steps
// =============================================================================

Then('rendering should complete in under {int}ms', function(maxTime) {
  const renderStats = testContext.performanceTracker.getStats('template-render');
  expect(renderStats.avg).to.be.below(maxTime, 
    `Average rendering took ${renderStats.avg}ms, should be under ${maxTime}ms`);
});

Then('hash calculation should be performant', function() {
  const storeStats = testContext.performanceTracker.getStats('cas-store');
  expect(storeStats.count).to.be.greaterThan(0, 'Should have performed at least one store operation');
  expect(storeStats.p95).to.be.below(10, `95th percentile hash time ${storeStats.p95}ms should be under 10ms`);
});

// =============================================================================
// File System Integration Steps
// =============================================================================

When('I generate a file using CAS-backed template {string}', async function(templateName) {
  const template = testContext.templates.get(templateName);
  expect(template).to.not.be.undefined;
  
  const variables = { name: 'CASTestComponent', withProps: false };
  const result = await testContext.templateEngine.render(template, variables);
  
  const filePath = path.join(testContext.testWorkspace, 'generated-file.tsx');
  await FileSystemHelper.writeFileAtomic(filePath, result.content);
  
  // Store content hash for verification
  const hash = await testContext.casEngine.store(result.content);
  testContext.contentHashes.set('generated_file', hash);
  testContext.testResults.set('generated_file_path', filePath);
});

Then('the generated file should exist and have correct content hash', async function() {
  const filePath = testContext.testResults.get('generated_file_path');
  const expectedHash = testContext.contentHashes.get('generated_file');
  
  expect(filePath).to.not.be.undefined;
  expect(expectedHash).to.not.be.undefined;
  
  // Verify file exists and has correct hash
  const isValid = await FileSystemHelper.verifyFileHash(filePath, expectedHash);
  expect(isValid).to.be.true, 'Generated file content hash should match CAS hash');
});

// =============================================================================
// Storage and Item Count Validation
// =============================================================================

Then('I should have {int} items in CAS storage', async function(expectedCount) {
  const metrics = testContext.casEngine.getMetrics();
  expect(metrics.cacheSize).to.equal(expectedCount, `CAS should contain ${expectedCount} items`);
});

// =============================================================================
// Cleanup and Utility Steps
// =============================================================================

Given('I clear all CAS storage', async function() {
  await testContext.casEngine.clear(true);
  testContext.contentHashes.clear();
  testContext.deterministicHashes = [];
});

// Debug step for development and troubleshooting
When('I debug the current test state', function() {
  console.log('=== Test State Debug ===');
  console.log('Templates:', Array.from(testContext.templates.keys()));
  console.log('Content Hashes:', Array.from(testContext.contentHashes.entries()));
  console.log('Cache Metrics:', testContext.cacheMetrics);
  console.log('Performance Stats:', {
    render: testContext.performanceTracker.getStats('template-render'),
    store: testContext.performanceTracker.getStats('cas-store'),
    retrieve: testContext.performanceTracker.getStats('cas-retrieve')
  });
  console.log('Deterministic Hashes:', testContext.deterministicHashes);
  console.log('========================');
});

// Performance reporting step
Then('I should see performance metrics summary', function() {
  const stats = {
    templateRender: testContext.performanceTracker.getStats('template-render'),
    casStore: testContext.performanceTracker.getStats('cas-store'),
    casRetrieve: testContext.performanceTracker.getStats('cas-retrieve')
  };
  
  console.log('=== Performance Metrics Summary ===');
  Object.entries(stats).forEach(([operation, stat]) => {
    if (stat.count > 0) {
      console.log(`${operation}: ${stat.count} ops, avg: ${stat.avg.toFixed(2)}ms, p95: ${stat.p95.toFixed(2)}ms`);
    }
  });
  console.log('====================================');
  
  // Verify basic performance requirements
  if (stats.templateRender.count > 0) {
    expect(stats.templateRender.p95).to.be.below(1000, 'Template rendering p95 should be under 1000ms');
  }
  if (stats.casStore.count > 0) {
    expect(stats.casStore.p95).to.be.below(50, 'CAS store p95 should be under 50ms');
  }
});

// Cleanup after tests
After(async function() {
  if (testContext.testWorkspace) {
    await FileSystemHelper.cleanupWorkspace(testContext.testWorkspace);
  }
});
// =============================================================================
// FEATURE REQUIREMENT ALIGNMENT STEPS
// =============================================================================

// Additional step for exit code validation (for drift detection)
Then('the command should exit with code {int}', function(expectedExitCode) {
  const actualExitCode = testContext.testResults.get('last_exit_code') || 0;
  expect(actualExitCode).to.equal(expectedExitCode, `Expected exit code ${expectedExitCode}, got ${actualExitCode}`);
});

// Step for file existence validation with non-zero size (multi-format)
Then('the file {string} should exist with non-zero size', async function(filename) {
  const filePath = testContext.testResults.get(`file_path_${filename}`);
  expect(filePath).to.not.be.undefined;
  
  const stats = await fs.stat(filePath);
  expect(stats.size).to.be.greaterThan(0, `File ${filename} should have non-zero size`);
});

// Additional step for verifying attestation file fields match hashes
Then('the attestation file should contain field {string} matching the content hash', async function(fieldName) {
  expect(testContext.testResults.has('attestation_validation')).to.be.true;
  const attestationData = testContext.testResults.get('attestation_validation');
  expect(attestationData[fieldName]).to.not.be.undefined;
  
  // Verify the field value matches the actual content hash
  const expectedHash = testContext.contentHashes.get('attestation_target_content');
  expect(attestationData[fieldName]).to.equal(expectedHash, `Field ${fieldName} should match content hash`);
});

// Step for validating frontmatter injection results
Then('the file {string} should contain injected content after marker {string}', async function(filename, marker) {
  const filePath = testContext.testResults.get(`file_path_${filename}`);
  expect(filePath).to.not.be.undefined;
  
  const content = await fs.readFile(filePath, 'utf8');
  const markerIndex = content.indexOf(marker);
  expect(markerIndex).to.be.greaterThan(-1, `Marker ${marker} should exist in file`);
  
  const injectedContent = testContext.testResults.get('injected_content');
  expect(injectedContent).to.not.be.undefined;
  
  const contentAfterMarker = content.substring(markerIndex + marker.length);
  expect(contentAfterMarker).to.contain(injectedContent, 'File should contain injected content after marker');
});

// Step for multi-format validation
Then('all {int} formats should exist with non-zero size', async function(expectedCount) {
  const formatResults = testContext.testResults.get('format_results') || new Map();
  expect(formatResults.size).to.equal(expectedCount, `Should have ${expectedCount} format files`);
  
  for (const [format, filePath] of formatResults.entries()) {
    const stats = await fs.stat(filePath);
    expect(stats.size).to.be.greaterThan(0, `${format} format file should have non-zero size`);
  }
});
